"""
Bets DB — Firestore 배팅 데이터 관리
컬렉션:
  - market_cache: 배당 API 캐시
  - betting_slips: 유저 배팅 슬립
  - odds_history: 배당 변동 추적 (스냅샷)
"""
import datetime
import logging
import os
import json

logger = logging.getLogger(__name__)

# Firestore Collection Names
MARKET_CACHE_COLLECTION = "market_cache"
BETTING_SLIPS_COLLECTION = "betting_slips"
ODDS_HISTORY_COLLECTION = "odds_history"

# Local JSON fallback
_HISTORY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
_HISTORY_FILE = os.path.join(_HISTORY_DIR, "odds_history.json")


def _get_firestore():
    """Get Firestore client, returns None if unavailable."""
    try:
        from app.db.firestore import get_firestore_db
        return get_firestore_db()
    except Exception:
        return None


# ─────────────────────────────────────────────
# MARKET CACHE
# ─────────────────────────────────────────────

async def get_market_cache(key: str):
    db = _get_firestore()
    if db:
        try:
            doc_ref = db.collection(MARKET_CACHE_COLLECTION).document(key)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            logger.warning(f"Market cache read failed: {e}")
    return None


async def set_market_cache(key: str, data: str):
    db = _get_firestore()
    if db:
        try:
            doc_ref = db.collection(MARKET_CACHE_COLLECTION).document(key)
            doc_ref.set({
                "data": data,
                "updated_at": datetime.datetime.utcnow()
            })
        except Exception as e:
            logger.warning(f"Market cache write failed: {e}")


# ─────────────────────────────────────────────
# ODDS HISTORY (Local JSON fallback)
# ─────────────────────────────────────────────

def _load_local_history() -> dict:
    """Load odds history from local JSON file."""
    try:
        if os.path.exists(_HISTORY_FILE):
            with open(_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _save_local_history(data: dict):
    """Save odds history to local JSON file."""
    os.makedirs(_HISTORY_DIR, exist_ok=True)
    with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, default=str)


async def save_odds_snapshot(team_home: str, team_away: str, home_odds: float, draw_odds: float, away_odds: float, league: str = ""):
    """Save a single odds snapshot for a match."""
    match_key = f"{team_home}_{team_away}"
    now = datetime.datetime.utcnow()

    db = _get_firestore()
    if db:
        try:
            db.collection(ODDS_HISTORY_COLLECTION).document(match_key).collection("snapshots").add({
                "home_odds": home_odds, "draw_odds": draw_odds, "away_odds": away_odds,
                "league": league, "timestamp": now,
            })
            return
        except Exception as e:
            logger.warning(f"Odds snapshot save failed: {e}")

    # Fallback: local JSON
    history = _load_local_history()
    if match_key not in history:
        history[match_key] = []
    history[match_key].append({
        "home_odds": home_odds, "draw_odds": draw_odds, "away_odds": away_odds,
        "timestamp": now.isoformat() + "Z",
    })
    history[match_key] = history[match_key][-50:]
    _save_local_history(history)


async def save_odds_snapshots_batch(items: list):
    """Save multiple odds snapshots."""
    now = datetime.datetime.utcnow()

    db = _get_firestore()
    if db:
        try:
            batch = db.batch()
            count = 0
            for item in items:
                match_key = f"{item['team_home']}_{item['team_away']}"
                snap_ref = db.collection(ODDS_HISTORY_COLLECTION).document(match_key).collection("snapshots").document()
                batch.set(snap_ref, {
                    "home_odds": item["home_odds"], "draw_odds": item["draw_odds"], "away_odds": item["away_odds"],
                    "league": item.get("league", ""), "timestamp": now,
                })
                count += 1
                if count >= 400:  # Firestore batch limit is 500
                    batch.commit()
                    batch = db.batch()
                    count = 0
            if count > 0:
                batch.commit()
            logger.info(f"✅ Saved {len(items)} odds snapshots to Firestore")
            return
        except Exception as e:
            logger.warning(f"Batch odds save failed: {e}")

    # Fallback: local JSON
    now_str = now.isoformat() + "Z"
    history = _load_local_history()
    for item in items:
        match_key = f"{item['team_home']}_{item['team_away']}"
        if match_key not in history:
            history[match_key] = []
        history[match_key].append({
            "home_odds": item["home_odds"], "draw_odds": item["draw_odds"], "away_odds": item["away_odds"],
            "timestamp": now_str,
        })
        history[match_key] = history[match_key][-50:]
    _save_local_history(history)


async def get_odds_history(team_home: str, team_away: str, limit: int = 20) -> list:
    """Get the last N odds snapshots for a match."""
    match_key = f"{team_home}_{team_away}"

    db = _get_firestore()
    if db:
        try:
            from google.cloud.firestore_v1 import Query
            docs = (
                db.collection(ODDS_HISTORY_COLLECTION)
                .document(match_key)
                .collection("snapshots")
                .order_by("timestamp", direction=Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            results = []
            for doc in docs:
                d = doc.to_dict()
                ts = d.get("timestamp")
                results.append({
                    "timestamp": ts.isoformat() + "Z" if hasattr(ts, "isoformat") else str(ts),
                    "home_odds": d.get("home_odds", 0),
                    "draw_odds": d.get("draw_odds", 0),
                    "away_odds": d.get("away_odds", 0),
                })
            results.reverse()
            return results
        except Exception as e:
            logger.warning(f"Odds history read failed: {e}")

    # Fallback: local JSON
    history = _load_local_history()
    points = history.get(match_key, [])
    return points[-limit:]


# ─────────────────────────────────────────────
# BETTING SLIP
# ─────────────────────────────────────────────

async def save_betting_slip(user_id: str, items: list, total_odds: float, potential_return: float):
    db = _get_firestore()
    if not db:
        logger.error("Firestore unavailable — cannot save betting slip")
        return None
    doc_ref = db.collection(BETTING_SLIPS_COLLECTION).document()
    doc_ref.set({
        "user_id": user_id,
        "items": items,
        "total_odds": total_odds,
        "potential_return": potential_return,
        "status": "PENDING",
        "created_at": datetime.datetime.utcnow()
    })
    return doc_ref.id


async def get_user_betting_slips(user_id: str):
    db = _get_firestore()
    if not db:
        return []
    try:
        from google.cloud.firestore_v1 import Query
        docs = db.collection(BETTING_SLIPS_COLLECTION).where("user_id", "==", user_id).order_by("created_at", direction=Query.DESCENDING).stream()
        return [{**doc.to_dict(), "id": doc.id} for doc in docs]
    except Exception as e:
        logger.warning(f"Get user slips failed: {e}")
        return []


async def get_all_pending_slips() -> list:
    """Get all betting slips with PENDING status for auto-settlement."""
    db = _get_firestore()
    if not db:
        return []
    try:
        docs = db.collection(BETTING_SLIPS_COLLECTION).where("status", "==", "PENDING").stream()
        return [{**doc.to_dict(), "id": doc.id} for doc in docs]
    except Exception as e:
        logger.warning(f"Get pending slips failed: {e}")
        return []


async def update_slip_status(slip_id: str, status: str, results: list = None):
    """
    Update a betting slip's status after grading.

    Args:
        slip_id: Firestore document ID
        status: 'WON', 'LOST', 'PUSH', 'PARTIAL', 'PENDING'
        results: Per-item grade results [{match, grade, score}, ...]
    """
    db = _get_firestore()
    if not db:
        logger.error("Firestore unavailable — cannot update slip")
        return
    update_data = {
        "status": status,
        "settled_at": datetime.datetime.utcnow(),
    }
    if results:
        update_data["grade_results"] = results
    db.collection(BETTING_SLIPS_COLLECTION).document(slip_id).update(update_data)
