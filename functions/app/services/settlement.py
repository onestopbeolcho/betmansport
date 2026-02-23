"""
Settlement service — grades predictions AND betting slips based on match results.

Two settlement flows:
1. Prediction League: XP/tier system for community predictions
2. Betting Slips: Actual portfolio win/loss grading with ROI tracking
"""
import logging
from app.models.prediction_db import (
    get_match_predictions,
    update_prediction,
    get_prediction_user,
    upsert_prediction_user,
    get_user_predictions,
)
from app.models.bets_db import get_all_pending_slips, update_slip_status
from app.core.result_grader import result_grader

logger = logging.getLogger(__name__)


def calculate_tier(points: int) -> str:
    if points >= 300:
        return "Master"
    if points >= 100:
        return "Expert"
    if points >= 50:
        return "Pro"
    return "Rookie"


# ──────────────────────────────────────────────
# 1. Prediction League Settlement (existing)
# ──────────────────────────────────────────────
async def settle_match(match_id: str, winner: str) -> int:
    """
    Grades all PENDING predictions for a specific match.
    Used for community prediction league (XP/tier system).
    """
    settled_count = 0

    try:
        predictions = await get_match_predictions(match_id)
    except Exception as e:
        logger.error(f"Failed to fetch predictions for {match_id}: {e}")
        return 0

    for pred in predictions:
        if pred.get("status") != "PENDING":
            continue

        pred_id = pred["id"]
        user_id = pred["user_id"]

        if pred["selection"] == winner:
            status = "WON"
            points_earned = 10
        else:
            status = "LOST"
            points_earned = 1

        try:
            await update_prediction(pred_id, {
                "status": status,
                "points_earned": points_earned,
            })
        except Exception as e:
            logger.error(f"Failed to update prediction {pred_id}: {e}")
            continue

        # Recalculate user stats
        try:
            all_user_preds = await get_user_predictions(user_id)
            total = len(all_user_preds)
            wins = sum(1 for p in all_user_preds if p.get("status") == "WON")
            losses = sum(1 for p in all_user_preds if p.get("status") == "LOST")
            push = sum(1 for p in all_user_preds if p.get("status") == "PUSH")
            total_points = sum(p.get("points_earned", 0) for p in all_user_preds)
            accuracy = round((wins / total * 100), 1) if total > 0 else 0.0

            await upsert_prediction_user(user_id, {
                "user_id": user_id,
                "total_predictions": total,
                "wins": wins,
                "losses": losses,
                "push": push,
                "points": total_points,
                "accuracy": accuracy,
                "tier": calculate_tier(total_points),
            })
        except Exception as e:
            logger.error(f"Failed to update user stats for {user_id}: {e}")

        settled_count += 1

    logger.info(f"Settled {settled_count} predictions for match {match_id}")
    return settled_count


# ──────────────────────────────────────────────
# 2. Betting Slip Auto-Settlement (NEW)
# ──────────────────────────────────────────────
async def auto_settle_slips() -> dict:
    """
    Automatically grades all PENDING betting slips using The Odds API scores.
    
    Flow:
    1. Fetch all completed scores from The Odds API
    2. Get all PENDING slips from Firestore
    3. Grade each slip using result_grader
    4. Update slip status in Firestore
    
    Returns:
        {"total_checked": int, "settled": int, "won": int, "lost": int, "partial": int}
    """
    stats = {"total_checked": 0, "settled": 0, "won": 0, "lost": 0, "partial": 0, "push": 0}

    # 1. Fetch latest scores
    try:
        await result_grader.fetch_all_scores(days_from=3)
    except Exception as e:
        logger.error(f"Failed to fetch scores: {e}")
        return stats

    # 2. Get pending slips
    try:
        pending_slips = await get_all_pending_slips()
    except Exception as e:
        logger.error(f"Failed to fetch pending slips: {e}")
        return stats

    logger.info(f"Found {len(pending_slips)} pending slips to check")
    stats["total_checked"] = len(pending_slips)

    # 3. Grade each slip
    for slip in pending_slips:
        slip_id = slip.get("id")
        if not slip_id:
            continue

        try:
            grade_result = await result_grader.grade_slip(slip)
            overall_status = grade_result["status"]

            # Only update if status changed from PENDING
            if overall_status != "PENDING":
                await update_slip_status(
                    slip_id=slip_id,
                    status=overall_status,
                    results=grade_result["results"],
                )
                stats["settled"] += 1

                if overall_status == "WON":
                    stats["won"] += 1
                elif overall_status == "LOST":
                    stats["lost"] += 1
                elif overall_status == "PARTIAL":
                    stats["partial"] += 1
                elif overall_status == "PUSH":
                    stats["push"] += 1

                logger.info(f"Slip {slip_id} → {overall_status}")
        except Exception as e:
            logger.error(f"Failed to grade slip {slip_id}: {e}")

    logger.info(f"Auto-settlement complete: {stats}")
    return stats
