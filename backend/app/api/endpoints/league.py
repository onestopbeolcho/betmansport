from fastapi import APIRouter, Depends, HTTPException
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/leaderboard")
async def get_leaderboard(limit: int = 50, sort_by: str = "total_roi"):
    """
    Get the top users based on their prediction stats.
    sort_by can be 'total_roi', 'hit_rate', 'won'
    """
    try:
        from app.models.user_db import get_all_users
        users = await get_all_users(limit=1000)  # get a batch and sort in memory if not indexed, or just 1000
        
        valid_users = []
        for u in users:
            stats = u.get("stats")
            if stats and stats.get("prediction_count", 0) > 0:
                # Calculate dynamically just in case
                total_decided = stats.get("won", 0) + stats.get("lost", 0) + stats.get("partial", 0)
                hit_rate = round(stats.get("won", 0) / total_decided * 100, 2) if total_decided > 0 else 0.0
                
                valid_users.append({
                    "id": u.get("id"),
                    "email": u.get("email"),
                    "nickname": u.get("nickname") or u.get("email", "").split("@")[0],
                    "role": u.get("role", "free"),
                    "prediction_count": stats.get("prediction_count", 0),
                    "won": stats.get("won", 0),
                    "lost": stats.get("lost", 0),
                    "total_roi": stats.get("total_roi", 0.0),
                    "hit_rate": hit_rate
                })
        
        # Sort
        if sort_by == "hit_rate":
            valid_users.sort(key=lambda x: x["hit_rate"], reverse=True)
        elif sort_by == "won":
            valid_users.sort(key=lambda x: x["won"], reverse=True)
        else:
            valid_users.sort(key=lambda x: x["total_roi"], reverse=True)
            
        return {"users": valid_users[:limit]}
        
    except Exception as e:
        logger.error(f"Failed to fetch leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard")
