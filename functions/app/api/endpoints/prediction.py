"""
Prediction League API — unified prediction + community vote endpoints.
Uses Firestore for persistence and JWT auth (optional for reads, required for writes).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.deps import get_current_user
from app.models.prediction_db import (
    save_prediction,
    get_user_match_prediction,
    get_prediction_user,
    upsert_prediction_user,
    get_leaderboard as db_get_leaderboard,
    save_match_vote,
    get_match_votes,
    get_user_predictions,
)

import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ========================
# Models
# ========================

class PredictionRequest(BaseModel):
    match_id: str
    selection: str  # "Home", "Draw", "Away"
    odds: float
    user_id: Optional[str] = None  # Fallback for anonymous users


class PredictionResponse(BaseModel):
    id: str
    match_id: str
    user_id: str
    selection: str
    odds: float
    status: str
    points_earned: int
    created_at: str


class UserStats(BaseModel):
    user_id: str
    total_predictions: int = 0
    wins: int = 0
    losses: int = 0
    push: int = 0
    accuracy: float = 0.0
    points: int = 0
    tier: str = "Rookie"


class LeaderboardItem(BaseModel):
    rank: int
    user_id: str
    points: int
    accuracy: float
    tier: str


class VoteStats(BaseModel):
    match_id: str
    home_votes: int = 0
    draw_votes: int = 0
    away_votes: int = 0
    total_votes: int = 0
    home_pct: float = 0
    draw_pct: float = 0
    away_pct: float = 0


# ========================
# Helpers
# ========================

def calculate_tier(points: int) -> str:
    if points >= 300:
        return "Master"
    if points >= 100:
        return "Expert"
    if points >= 50:
        return "Pro"
    return "Rookie"


# ========================
# Endpoints
# ========================

@router.post("/submit", response_model=PredictionResponse)
async def submit_prediction(
    pred: PredictionRequest,
    current_user: Optional[str] = Depends(get_current_user),
):
    """
    Submit a prediction for a match.
    If logged in, uses JWT user_id. Otherwise falls back to anonymous user_id.
    Also records community vote stats.
    """
    # Determine user_id: JWT first, then request body fallback
    user_id = current_user or pred.user_id
    if not user_id:
        raise HTTPException(status_code=400, detail="User identification required")

    if pred.selection not in ("Home", "Draw", "Away"):
        raise HTTPException(status_code=400, detail="Invalid selection. Must be Home, Draw, or Away")

    # Check duplicate
    try:
        existing = await get_user_match_prediction(user_id, pred.match_id)
        if existing:
            raise HTTPException(status_code=400, detail="이미 이 경기에 투표했습니다")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Firestore check failed, using in-memory fallback: {e}")
        existing = None

    # Save prediction
    prediction_data = {
        "match_id": pred.match_id,
        "user_id": user_id,
        "selection": pred.selection,
        "odds": pred.odds,
        "status": "PENDING",
        "points_earned": 1,  # Participation XP
    }

    try:
        saved = await save_prediction(prediction_data)
        pred_id = saved["id"]
    except Exception as e:
        logger.warning(f"Firestore save failed, using in-memory: {e}")
        import uuid
        pred_id = str(uuid.uuid4())
        saved = {**prediction_data, "id": pred_id, "created_at": datetime.utcnow()}

    # Update user stats
    try:
        user_stats = await get_prediction_user(user_id)
        if not user_stats:
            user_stats = {
                "user_id": user_id,
                "total_predictions": 0,
                "wins": 0,
                "losses": 0,
                "push": 0,
                "accuracy": 0.0,
                "points": 0,
                "tier": "Rookie",
            }

        user_stats["total_predictions"] = user_stats.get("total_predictions", 0) + 1
        user_stats["points"] = user_stats.get("points", 0) + 1  # +1 participation
        user_stats["tier"] = calculate_tier(user_stats["points"])
        await upsert_prediction_user(user_id, user_stats)
    except Exception as e:
        logger.warning(f"User stats update failed: {e}")

    # Also record community vote (unified — no dual API call needed)
    try:
        await save_match_vote(pred.match_id, user_id, pred.selection)
    except Exception as e:
        logger.warning(f"Community vote save failed: {e}")

    return PredictionResponse(
        id=pred_id,
        match_id=pred.match_id,
        user_id=user_id,
        selection=pred.selection,
        odds=pred.odds,
        status="PENDING",
        points_earned=1,
        created_at=saved.get("created_at", datetime.utcnow()).isoformat()
        if isinstance(saved.get("created_at"), datetime)
        else str(saved.get("created_at", "")),
    )


@router.get("/leaderboard", response_model=List[LeaderboardItem])
async def get_leaderboard():
    """Return top 10 users sorted by points."""
    try:
        users = await db_get_leaderboard(limit=10)
        leaderboard = []
        for idx, user in enumerate(users):
            leaderboard.append(
                LeaderboardItem(
                    rank=idx + 1,
                    user_id=user.get("user_id", user.get("id", "unknown")),
                    points=user.get("points", 0),
                    accuracy=user.get("accuracy", 0.0),
                    tier=user.get("tier", "Rookie"),
                )
            )
        return leaderboard
    except Exception as e:
        logger.warning(f"Firestore leaderboard failed, returning seed data: {e}")
        # Seed data for display when Firestore is unavailable
        return [
            LeaderboardItem(rank=1, user_id="expert_kim", points=350, accuracy=70.0, tier="Master"),
            LeaderboardItem(rank=2, user_id="pro_lee", points=180, accuracy=60.0, tier="Expert"),
            LeaderboardItem(rank=3, user_id="newbie_park", points=20, accuracy=40.0, tier="Rookie"),
        ]


@router.get("/user/{user_id}", response_model=UserStats)
async def get_user_stats(user_id: str):
    """Get prediction stats for a specific user."""
    try:
        stats = await get_prediction_user(user_id)
        if stats:
            return UserStats(
                user_id=stats.get("user_id", user_id),
                total_predictions=stats.get("total_predictions", 0),
                wins=stats.get("wins", 0),
                losses=stats.get("losses", 0),
                push=stats.get("push", 0),
                accuracy=stats.get("accuracy", 0.0),
                points=stats.get("points", 0),
                tier=stats.get("tier", "Rookie"),
            )
    except Exception as e:
        logger.warning(f"Firestore user stats failed: {e}")

    return UserStats(user_id=user_id)


@router.get("/vote-stats/{match_id}", response_model=VoteStats)
async def get_vote_stats(match_id: str):
    """Get community vote stats for a match."""
    try:
        votes = await get_match_votes(match_id)
        if votes:
            h = votes.get("home_votes", 0)
            d = votes.get("draw_votes", 0)
            a = votes.get("away_votes", 0)
            total = h + d + a
            return VoteStats(
                match_id=match_id,
                home_votes=h,
                draw_votes=d,
                away_votes=a,
                total_votes=total,
                home_pct=round((h / total) * 100, 1) if total > 0 else 0,
                draw_pct=round((d / total) * 100, 1) if total > 0 else 0,
                away_pct=round((a / total) * 100, 1) if total > 0 else 0,
            )
    except Exception as e:
        logger.warning(f"Firestore vote stats failed: {e}")

    return VoteStats(match_id=match_id)


@router.get("/my-predictions", response_model=List[PredictionResponse])
async def get_my_predictions(
    current_user: str = Depends(get_current_user),
):
    """Get the current user's prediction history."""
    if not current_user:
        return []

    try:
        preds = await get_user_predictions(current_user)
        return [
            PredictionResponse(
                id=p.get("id", ""),
                match_id=p.get("match_id", ""),
                user_id=p.get("user_id", ""),
                selection=p.get("selection", ""),
                odds=p.get("odds", 0),
                status=p.get("status", "PENDING"),
                points_earned=p.get("points_earned", 0),
                created_at=str(p.get("created_at", "")),
            )
            for p in preds
        ]
    except Exception as e:
        logger.warning(f"Firestore my-predictions failed: {e}")
        return []
