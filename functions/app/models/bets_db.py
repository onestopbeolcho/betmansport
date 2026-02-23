import datetime
from app.db.firestore import get_firestore_db
from google.cloud import firestore

# Firestore Collection Names
MARKET_CACHE_COLLECTION = "market_cache"
BETTING_SLIPS_COLLECTION = "betting_slips"
ODDS_HISTORY_COLLECTION = "odds_history"

async def get_market_cache(key: str):
    db = get_firestore_db()
    doc_ref = db.collection(MARKET_CACHE_COLLECTION).document(key)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None

async def set_market_cache(key: str, data: str):
    db = get_firestore_db()
    doc_ref = db.collection(MARKET_CACHE_COLLECTION).document(key)
    doc_ref.set({
        "data": data,
        "updated_at": datetime.datetime.utcnow()
    })


# --- Odds History ---
# Uses Firestore in production, falls back to local JSON file for local dev

import os as _os
import json as _json

_HISTORY_DIR = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))), "data")
_HISTORY_FILE = _os.path.join(_HISTORY_DIR, "odds_history.json")


def _load_local_history() -> dict:
    """Load odds history from local JSON file."""
    try:
        if _os.path.exists(_HISTORY_FILE):
            with open(_HISTORY_FILE, "r", encoding="utf-8") as f:
                return _json.load(f)
    except Exception:
        pass
    return {}


def _save_local_history(data: dict):
    """Save odds history to local JSON file."""
    _os.makedirs(_HISTORY_DIR, exist_ok=True)
    with open(_HISTORY_FILE, "w", encoding="utf-8") as f:
        _json.dump(data, f, ensure_ascii=False, default=str)


def _is_firestore_available() -> bool:
    """Check if Firestore is available (has credentials)."""
    try:
        get_firestore_db()
        return True
    except Exception:
        return False


async def save_odds_snapshot(team_home: str, team_away: str, home_odds: float, draw_odds: float, away_odds: float, league: str = ""):
    """Save a single odds snapshot for a match."""
    match_key = f"{team_home}_{team_away}"
    now = datetime.datetime.utcnow().isoformat() + "Z"

    if _is_firestore_available():
        try:
            db = get_firestore_db()
            db.collection(ODDS_HISTORY_COLLECTION).document(match_key).collection("snapshots").add({
                "home_odds": home_odds, "draw_odds": draw_odds, "away_odds": away_odds,
                "league": league, "timestamp": datetime.datetime.utcnow(),
            })
            return
        except Exception:
            pass

    # Fallback: local JSON
    history = _load_local_history()
    if match_key not in history:
        history[match_key] = []
    history[match_key].append({
        "home_odds": home_odds, "draw_odds": draw_odds, "away_odds": away_odds,
        "timestamp": now,
    })
    # Keep only last 50 per match
    history[match_key] = history[match_key][-50:]
    _save_local_history(history)


async def save_odds_snapshots_batch(items: list):
    """Save multiple odds snapshots."""
    now = datetime.datetime.utcnow()

    if _is_firestore_available():
        try:
            db = get_firestore_db()
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
                if count >= 400:
                    batch.commit()
                    batch = db.batch()
                    count = 0
            if count > 0:
                batch.commit()
            return
        except Exception:
            pass

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

    if _is_firestore_available():
        try:
            db = get_firestore_db()
            docs = (
                db.collection(ODDS_HISTORY_COLLECTION)
                .document(match_key)
                .collection("snapshots")
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )
            results = []
            for doc in docs:
                d = doc.to_dict()
                ts = d.get("timestamp")
                results.append({
                    "timestamp": ts.isoformat() + "Z" if ts else "",
                    "home_odds": d.get("home_odds", 0),
                    "draw_odds": d.get("draw_odds", 0),
                    "away_odds": d.get("away_odds", 0),
                })
            results.reverse()
            return results
        except Exception:
            pass

    # Fallback: local JSON
    history = _load_local_history()
    points = history.get(match_key, [])
    return points[-limit:]


# --- Betting Slip ---

async def save_betting_slip(user_id: str, items: list, total_odds: float, potential_return: float):
    db = get_firestore_db()
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
    db = get_firestore_db()
    docs = db.collection(BETTING_SLIPS_COLLECTION).where("user_id", "==", user_id).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


async def get_all_pending_slips() -> list:
    """Get all betting slips with PENDING status for auto-settlement."""
    db = get_firestore_db()
    docs = db.collection(BETTING_SLIPS_COLLECTION).where("status", "==", "PENDING").stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


async def update_slip_status(slip_id: str, status: str, results: list = None):
    """
    Update a betting slip's status after grading.
    
    Args:
        slip_id: Firestore document ID
        status: 'WON', 'LOST', 'PUSH', 'PARTIAL', 'PENDING'
        results: Per-item grade results [{match, grade, score}, ...]
    """
    db = get_firestore_db()
    update_data = {
        "status": status,
        "settled_at": datetime.datetime.utcnow(),
    }
    if results:
        update_data["grade_results"] = results
    db.collection(BETTING_SLIPS_COLLECTION).document(slip_id).update(update_data)


