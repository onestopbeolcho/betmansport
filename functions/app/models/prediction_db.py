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
        from google.cloud.firestore import Increment
        updates[old_field] = Increment(-1)
        updates[selection_field] = Increment(1)
    elif not old_selection:
        from google.cloud.firestore import Increment
        updates[selection_field] = Increment(1)
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
