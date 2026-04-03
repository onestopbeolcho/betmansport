"""
Firestore helpers for the Prediction League system.
Collections:
  - predictions: Individual user predictions
  - prediction_users: User stats (XP, tier, accuracy)
  - community_votes: Vote aggregates per match
"""
import datetime
import logging
from typing import Optional, Dict, List
from app.db.firestore import get_firestore_db

logger = logging.getLogger(__name__)

PREDICTIONS_COLLECTION = "predictions"
PREDICTION_USERS_COLLECTION = "prediction_users"
COMMUNITY_VOTES_COLLECTION = "community_votes"


# ========================
# PREDICTIONS
# ========================

async def save_prediction(prediction_data: dict) -> dict:
    """Save a new prediction to Firestore. Returns the saved data with ID."""
    db = get_firestore_db()
    doc_ref = db.collection(PREDICTIONS_COLLECTION).document()
    prediction_data["created_at"] = datetime.datetime.utcnow()
    doc_ref.set(prediction_data)
    return {**prediction_data, "id": doc_ref.id}


async def get_user_match_prediction(user_id: str, match_id: str) -> Optional[dict]:
    """Check if a user already predicted a specific match."""
    db = get_firestore_db()
    docs = (
        db.collection(PREDICTIONS_COLLECTION)
        .where("user_id", "==", user_id)
        .where("match_id", "==", match_id)
        .limit(1)
        .stream()
    )
    for doc in docs:
        return {**doc.to_dict(), "id": doc.id}
    return None


async def get_match_predictions(match_id: str) -> List[dict]:
    """Get all predictions for a specific match."""
    db = get_firestore_db()
    docs = (
        db.collection(PREDICTIONS_COLLECTION)
        .where("match_id", "==", match_id)
        .stream()
    )
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


async def update_prediction(pred_id: str, updates: dict):
    """Update a prediction document (e.g., set status to WON/LOST)."""
    db = get_firestore_db()
    doc_ref = db.collection(PREDICTIONS_COLLECTION).document(pred_id)
    doc_ref.update(updates)


async def get_user_predictions(user_id: str) -> List[dict]:
    """Get all predictions by a user, newest first."""
    db = get_firestore_db()
    docs = (
        db.collection(PREDICTIONS_COLLECTION)
        .where("user_id", "==", user_id)
        .order_by("created_at", direction="DESCENDING")
        .stream()
    )
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


# ========================
# USER STATS (Prediction League)
# ========================

async def get_prediction_user(user_id: str) -> Optional[dict]:
    """Get prediction stats for a user."""
    db = get_firestore_db()
    doc_ref = db.collection(PREDICTION_USERS_COLLECTION).document(user_id)
    doc = doc_ref.get()
    if doc.exists:
        return {**doc.to_dict(), "id": doc.id}
    return None


async def upsert_prediction_user(user_id: str, stats: dict):
    """Create or update prediction user stats."""
    db = get_firestore_db()
    doc_ref = db.collection(PREDICTION_USERS_COLLECTION).document(user_id)
    stats["updated_at"] = datetime.datetime.utcnow()
    doc_ref.set(stats, merge=True)


async def get_leaderboard(limit: int = 10) -> List[dict]:
    """Get top users sorted by points descending."""
    db = get_firestore_db()
    docs = (
        db.collection(PREDICTION_USERS_COLLECTION)
        .order_by("points", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]


# ========================
# COMMUNITY VOTES
# ========================

async def get_match_votes(match_id: str) -> Optional[dict]:
    """Get vote aggregates for a match."""
    db = get_firestore_db()
    doc_ref = db.collection(COMMUNITY_VOTES_COLLECTION).document(match_id)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return None


async def save_match_vote(match_id: str, user_id: str, selection: str) -> dict:
    """
    Record a vote. Uses Firestore sub-collection for individual votes
    and atomic increments for aggregates.
    """
    db = get_firestore_db()
    vote_doc_ref = db.collection(COMMUNITY_VOTES_COLLECTION).document(match_id)

    # Check if this user already voted on this match
    user_vote_ref = vote_doc_ref.collection("user_votes").document(user_id)
    user_vote = user_vote_ref.get()

    old_selection = None
    if user_vote.exists:
        old_selection = user_vote.to_dict().get("selection")

    # Save/update user's vote
    user_vote_ref.set({"selection": selection, "updated_at": datetime.datetime.utcnow()})

    # Update aggregate counts
    vote_data = vote_doc_ref.get()
    if not vote_data.exists:
        # Initialize
        vote_doc_ref.set({
            "match_id": match_id,
            "home_votes": 0,
            "draw_votes": 0,
            "away_votes": 0,
        })

    # Build update: decrement old, increment new
    updates = {}
    selection_field = f"{selection.lower()}_votes"

    if old_selection and old_selection != selection:
        old_field = f"{old_selection.lower()}_votes"
        from google.cloud.firestore_v1 import transforms
        updates[old_field] = transforms.Increment(-1)
        updates[selection_field] = transforms.Increment(1)
    elif not old_selection:
        from google.cloud.firestore_v1 import transforms
        updates[selection_field] = transforms.Increment(1)
    # else: same selection, no change

    if updates:
        vote_doc_ref.update(updates)

    # Read back updated stats
    updated = vote_doc_ref.get().to_dict()
    h = updated.get("home_votes", 0)
    d = updated.get("draw_votes", 0)
    a = updated.get("away_votes", 0)
    total = h + d + a

    return {
        "match_id": match_id,
        "home_votes": h,
        "draw_votes": d,
        "away_votes": a,
        "total_votes": total,
        "home_pct": round((h / total) * 100, 1) if total > 0 else 0,
        "draw_pct": round((d / total) * 100, 1) if total > 0 else 0,
        "away_pct": round((a / total) * 100, 1) if total > 0 else 0,
    }


# ========================
# MATCH RESULTS (경기당 1문서)
# ========================

MATCH_RESULTS_COLLECTION = "match_results"


async def save_match_result(match_id: str, result_data: dict) -> dict:
    """경기 결과 저장 (중복 시 덮어쓰기 방지)."""
    db = get_firestore_db()
    doc_ref = db.collection(MATCH_RESULTS_COLLECTION).document(match_id)
    existing = doc_ref.get()
    if existing.exists:
        return {**existing.to_dict(), "id": existing.id}
    result_data["match_id"] = match_id
    result_data["settled_at"] = datetime.datetime.utcnow()
    doc_ref.set(result_data)
    logger.info(f"Saved match result: {match_id}")
    return {**result_data, "id": doc_ref.id}


async def get_match_result(match_id: str) -> Optional[dict]:
    """이미 정산된 경기인지 확인."""
    db = get_firestore_db()
    doc_ref = db.collection(MATCH_RESULTS_COLLECTION).document(match_id)
    doc = doc_ref.get()
    if doc.exists:
        return {**doc.to_dict(), "id": doc.id}
    return None


async def get_pending_match_ids() -> List[str]:
    """PENDING 상태의 prediction이 있는 고유 match_id 목록."""
    db = get_firestore_db()
    docs = (
        db.collection(PREDICTIONS_COLLECTION)
        .where("status", "==", "PENDING")
        .stream()
    )
    match_ids = set()
    for doc in docs:
        mid = doc.to_dict().get("match_id")
        if mid:
            match_ids.add(mid)
    return list(match_ids)


# ========================
# AI PREDICTION HISTORY (AI 적중률 추적)
# ========================

AI_HISTORY_COLLECTION = "ai_prediction_history"


async def save_ai_predictions_batch(predictions: List[dict]):
    """
    AI 예측을 일괄 저장 (경기 시작 전에 호출).
    중복 방지: match_id + prediction_date 조합으로 하루에 한 번만 저장.
    """
    db = get_firestore_db()
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    saved_count = 0

    for pred in predictions:
        match_id = pred.get("match_id", "")
        if not match_id:
            continue

        doc_id = f"{match_id}_{today}"
        doc_ref = db.collection(AI_HISTORY_COLLECTION).document(doc_id)
        existing = doc_ref.get()
        if existing.exists:
            continue  # 이미 저장됨

        doc_ref.set({
            "match_id": match_id,
            "team_home": pred.get("team_home", ""),
            "team_away": pred.get("team_away", ""),
            "league": pred.get("league", ""),
            "sport": pred.get("sport", "Soccer"),
            "match_time": pred.get("match_time", ""),
            "recommendation": pred.get("recommendation", ""),
            "confidence": pred.get("confidence", 0),
            "home_win_prob": pred.get("home_win_prob", 0),
            "draw_prob": pred.get("draw_prob", 0),
            "away_win_prob": pred.get("away_win_prob", 0),
            "prediction_date": today,
            "status": "PENDING",  # PENDING → HIT / MISS / PUSH
            "actual_result": None,  # HOME / DRAW / AWAY
            "home_score": None,
            "away_score": None,
            "graded_at": None,
            "created_at": datetime.datetime.utcnow(),
        })
        saved_count += 1

    logger.info(f"📊 AI predictions saved: {saved_count} new (date: {today})")
    return saved_count


async def grade_ai_predictions(results: List[dict]):
    """
    경기 결과로 AI 예측 적중/미적중 판정.
    results: [{"match_id": str, "home_score": int, "away_score": int, "status": str}]
    """
    db = get_firestore_db()
    graded_count = 0

    for result in results:
        match_id = result.get("match_id", "")
        home_score = result.get("home_score")
        away_score = result.get("away_score")

        if home_score is None or away_score is None:
            continue

        # 실제 결과 판정
        if home_score > away_score:
            actual = "HOME"
        elif home_score < away_score:
            actual = "AWAY"
        else:
            actual = "DRAW"

        # PENDING 상태인 이 경기의 AI 예측 문서 찾기
        docs = (
            db.collection(AI_HISTORY_COLLECTION)
            .where("match_id", "==", match_id)
            .where("status", "==", "PENDING")
            .stream()
        )

        for doc in docs:
            data = doc.to_dict()
            recommendation = data.get("recommendation", "")

            if recommendation == actual:
                grade = "HIT"
            else:
                grade = "MISS"

            doc.reference.update({
                "status": grade,
                "actual_result": actual,
                "home_score": home_score,
                "away_score": away_score,
                "graded_at": datetime.datetime.utcnow(),
            })
            graded_count += 1

    logger.info(f"📊 AI predictions graded: {graded_count}")
    return graded_count


async def get_ai_accuracy_stats(days: int = 30, league: str = None) -> dict:
    """
    AI 적중률 통계 반환.
    - 전체 적중률 (기간별)
    - 리그별 적중률
    - 일별 추이
    """
    db = get_firestore_db()
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)

    query = db.collection(AI_HISTORY_COLLECTION).where(
        "status", "in", ["HIT", "MISS"]
    )

    docs = query.stream()
    all_records = []
    for doc in docs:
        data = doc.to_dict()
        created = data.get("created_at")
        if created and hasattr(created, 'timestamp'):
            if created < cutoff:
                continue
        if league and data.get("league", "") != league:
            continue
        all_records.append(data)

    if not all_records:
        return {
            "total_predictions": 0,
            "hits": 0,
            "misses": 0,
            "accuracy_pct": 0,
            "by_league": {},
            "by_date": {},
            "period_days": days,
        }

    hits = sum(1 for r in all_records if r["status"] == "HIT")
    misses = sum(1 for r in all_records if r["status"] == "MISS")
    total = hits + misses

    # 리그별 통계
    by_league = {}
    for r in all_records:
        lg = r.get("league", "unknown")
        if lg not in by_league:
            by_league[lg] = {"hits": 0, "misses": 0, "total": 0}
        by_league[lg]["total"] += 1
        if r["status"] == "HIT":
            by_league[lg]["hits"] += 1
        else:
            by_league[lg]["misses"] += 1

    for lg in by_league:
        t = by_league[lg]["total"]
        by_league[lg]["accuracy_pct"] = round(by_league[lg]["hits"] / t * 100, 1) if t > 0 else 0

    # 일별 통계
    by_date = {}
    for r in all_records:
        date_str = r.get("prediction_date", "unknown")
        if date_str not in by_date:
            by_date[date_str] = {"hits": 0, "misses": 0, "total": 0}
        by_date[date_str]["total"] += 1
        if r["status"] == "HIT":
            by_date[date_str]["hits"] += 1
        else:
            by_date[date_str]["misses"] += 1

    for d in by_date:
        t = by_date[d]["total"]
        by_date[d]["accuracy_pct"] = round(by_date[d]["hits"] / t * 100, 1) if t > 0 else 0

    return {
        "total_predictions": total,
        "hits": hits,
        "misses": misses,
        "accuracy_pct": round(hits / total * 100, 1) if total > 0 else 0,
        "by_league": by_league,
        "by_date": dict(sorted(by_date.items())),
        "period_days": days,
    }


async def get_recent_ai_predictions(limit: int = 20, status: str = None) -> List[dict]:
    """최근 AI 예측 이력 조회 (대시보드용)."""
    db = get_firestore_db()
    query = db.collection(AI_HISTORY_COLLECTION).order_by(
        "created_at", direction="DESCENDING"
    ).limit(limit)

    if status:
        query = db.collection(AI_HISTORY_COLLECTION).where(
            "status", "==", status
        ).order_by("created_at", direction="DESCENDING").limit(limit)

    docs = query.stream()
    return [{**doc.to_dict(), "id": doc.id} for doc in docs]
