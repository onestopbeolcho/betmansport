"""
Betman 데이터 저장소 — Firestore 우선 + 로컬 JSON 폴백

저장 우선순위:
1. Firestore (betman_rounds 컬렉션) — 배포 환경 영구 저장
2. 인메모리 캐시 — 빠른 읽기
3. 로컬 JSON 파일 — Firestore 불가 시 폴백
"""
import json
import os
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone
import uuid

logger = logging.getLogger(__name__)

# Firestore collection name
BETMAN_ROUNDS_COLLECTION = "betman_rounds"
BETMAN_META_DOC = "betman_meta"

# In-memory cache (fast reads within same process)
_MEMORY_CACHE: Dict = {
    "rounds": {},
    "last_crawl": None,
    "last_round_id": None,
}

# Local JSON fallback paths
if os.name == "nt":  # Windows (local dev)
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
else:  # Cloud Functions
    DATA_DIR = "/tmp/betman_data"
BETMAN_FILE = os.path.join(DATA_DIR, "betman_odds.json")


# ─────────────────────────────────────────────
# FIRESTORE HELPERS
# ─────────────────────────────────────────────

def _get_firestore():
    """Get Firestore client, returns None if unavailable."""
    try:
        from app.db.firestore import get_firestore_db
        return get_firestore_db()
    except Exception:
        return None


# ─────────────────────────────────────────────
# LOCAL JSON HELPERS (fallback)
# ─────────────────────────────────────────────

def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _load_from_file() -> dict:
    """Load from local JSON file (fallback)."""
    try:
        if os.path.exists(BETMAN_FILE):
            with open(BETMAN_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {"rounds": {}, "last_crawl": None, "last_round_id": None}


def _save_to_file(db: dict):
    """Save to local JSON file."""
    try:
        _ensure_data_dir()
        with open(BETMAN_FILE, "w", encoding="utf-8") as f:
            json.dump(db, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"File save failed: {e}")


# ─────────────────────────────────────────────
# UNIFIED READ/WRITE (Firestore → Memory → File)
# ─────────────────────────────────────────────

def _get_db() -> dict:
    """Get current database. Priority: memory → Firestore → file."""
    global _MEMORY_CACHE

    # 1. Memory cache hit
    if _MEMORY_CACHE.get("last_round_id"):
        return _MEMORY_CACHE

    # 2. Try Firestore
    db = _get_firestore()
    if db:
        try:
            meta_doc = db.collection(BETMAN_ROUNDS_COLLECTION).document(BETMAN_META_DOC).get()
            if meta_doc.exists:
                meta = meta_doc.to_dict()
                last_round_id = meta.get("last_round_id")
                if last_round_id:
                    # Load all rounds from Firestore
                    rounds = {}
                    round_docs = db.collection(BETMAN_ROUNDS_COLLECTION).stream()
                    for doc in round_docs:
                        if doc.id == BETMAN_META_DOC:
                            continue
                        rounds[doc.id] = doc.to_dict()

                    _MEMORY_CACHE = {
                        "rounds": rounds,
                        "last_crawl": meta.get("last_crawl"),
                        "last_round_id": last_round_id,
                    }
                    logger.info(f"📂 Loaded {len(rounds)} rounds from Firestore")
                    return _MEMORY_CACHE
        except Exception as e:
            logger.warning(f"Firestore read failed: {e}")

    # 3. File fallback
    file_db = _load_from_file()
    if file_db.get("last_round_id"):
        _MEMORY_CACHE = file_db
        return _MEMORY_CACHE

    return _MEMORY_CACHE


def _save_db(db: dict):
    """Save to all layers: memory + Firestore + file."""
    global _MEMORY_CACHE
    _MEMORY_CACHE = db

    # Save to Firestore
    fs = _get_firestore()
    if fs:
        try:
            # Save meta document
            fs.collection(BETMAN_ROUNDS_COLLECTION).document(BETMAN_META_DOC).set({
                "last_crawl": db.get("last_crawl"),
                "last_round_id": db.get("last_round_id"),
                "total_rounds": len(db.get("rounds", {})),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

            # Save each round as a separate document
            for round_id, round_data in db.get("rounds", {}).items():
                fs.collection(BETMAN_ROUNDS_COLLECTION).document(round_id).set(round_data)

            logger.info(f"✅ Saved {len(db.get('rounds', {}))} rounds to Firestore")
        except Exception as e:
            logger.warning(f"Firestore save failed (using file fallback): {e}")

    # Always save to local file as backup
    _save_to_file(db)


# ─────────────────────────────────────────────
# SAVE / CRAWL RESULTS
# ─────────────────────────────────────────────

def save_betman_round(round_id: str, matches: List[Dict]) -> int:
    """Save crawled Betman matches."""
    db = _get_db()

    for m in matches:
        if "match_id" not in m:
            m["match_id"] = str(uuid.uuid4())[:8]
        m["source"] = m.get("source", "crawl")
        m["modified"] = False

    db["rounds"][round_id] = {
        "matches": matches,
        "crawled_at": datetime.now(timezone.utc).isoformat(),
        "match_count": len(matches),
    }
    db["last_crawl"] = datetime.now(timezone.utc).isoformat()
    db["last_round_id"] = round_id

    _save_db(db)
    logger.info(f"Saved {len(matches)} Betman matches for round {round_id}")
    return len(matches)


# ─────────────────────────────────────────────
# READ
# ─────────────────────────────────────────────

def load_betman_data() -> dict:
    """Unified data loader for scripts."""
    return _get_db()

def get_betman_matches(round_id: Optional[str] = None) -> List[Dict]:
    """Get Betman matches for the latest or specified round."""
    db = _get_db()

    if not round_id:
        round_id = db.get("last_round_id")
    if not round_id or round_id not in db.get("rounds", {}):
        return []

    return db["rounds"][round_id].get("matches", [])


def get_betman_rounds() -> List[Dict]:
    """Get list of all saved rounds."""
    db = _get_db()
    result = []
    for rid, rdata in db.get("rounds", {}).items():
        result.append({
            "round_id": rid,
            "match_count": rdata.get("match_count", 0),
            "crawled_at": rdata.get("crawled_at"),
        })
    result.sort(key=lambda x: x.get("crawled_at", ""), reverse=True)
    return result


def get_betman_status() -> Dict:
    """Get crawler status."""
    db = _get_db()
    return {
        "last_crawl": db.get("last_crawl"),
        "last_round_id": db.get("last_round_id"),
        "total_rounds": len(db.get("rounds", {})),
        "total_matches": sum(
            r.get("match_count", 0) for r in db.get("rounds", {}).values()
        ),
    }


# ─────────────────────────────────────────────
# UPDATE (Manual Edit)
# ─────────────────────────────────────────────

def update_betman_match(match_id: str, updates: Dict) -> Optional[Dict]:
    """Update a specific match by match_id."""
    db = _get_db()
    allowed_fields = {
        "team_home", "team_away", "home_odds", "draw_odds", "away_odds",
        "sport", "league", "match_time"
    }

    for rid, rdata in db.get("rounds", {}).items():
        for match in rdata.get("matches", []):
            if match.get("match_id") == match_id:
                for key, val in updates.items():
                    if key in allowed_fields:
                        match[key] = val
                match["modified"] = True
                match["modified_at"] = datetime.now(timezone.utc).isoformat()
                _save_db(db)
                return match
    return None


# ─────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────

def delete_betman_match(match_id: str) -> bool:
    """Delete a specific match by match_id."""
    db = _get_db()
    for rid, rdata in db.get("rounds", {}).items():
        matches = rdata.get("matches", [])
        original_len = len(matches)
        rdata["matches"] = [m for m in matches if m.get("match_id") != match_id]
        if len(rdata["matches"]) < original_len:
            rdata["match_count"] = len(rdata["matches"])
            _save_db(db)
            return True
    return False


# ─────────────────────────────────────────────
# ADD (Manual)
# ─────────────────────────────────────────────

def add_betman_match(match_data: Dict, round_id: Optional[str] = None) -> Dict:
    """Manually add a match."""
    db = _get_db()
    if not round_id:
        round_id = db.get("last_round_id")
    if not round_id:
        round_id = "manual_" + datetime.now(timezone.utc).strftime("%Y%m%d")

    if round_id not in db.get("rounds", {}):
        db["rounds"][round_id] = {
            "matches": [],
            "crawled_at": datetime.now(timezone.utc).isoformat(),
            "match_count": 0,
        }

    match_data["match_id"] = str(uuid.uuid4())[:8]
    match_data["source"] = "manual"
    match_data["modified"] = False

    db["rounds"][round_id]["matches"].append(match_data)
    db["rounds"][round_id]["match_count"] = len(db["rounds"][round_id]["matches"])
    db["last_round_id"] = round_id

    _save_db(db)
    return match_data
