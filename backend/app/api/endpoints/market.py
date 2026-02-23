from fastapi import APIRouter
from typing import List
from app.services.pinnacle_api import pinnacle_service
from app.schemas.odds import OddsItem, OddsHistoryItem
from app.models.bets_db import get_odds_history
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/pinnacle", response_model=List[OddsItem])
async def get_all_pinnacle_odds():
    """
    Return all cached Pinnacle odds without filtering.
    """
    return await pinnacle_service.fetch_odds()


@router.get("/history")
async def get_odds_history_endpoint(
    team_home: str,
    team_away: str,
):
    """
    Get odds history for a specific match.
    Returns the last 20 snapshots for the OddsHistoryChart.
    """
    try:
        history = await get_odds_history(team_home, team_away, limit=20)
        return history
    except Exception as e:
        logger.warning(f"Failed to fetch odds history: {e}")
        return []


@router.post("/seed_history")
async def seed_history_debug():
    """
    DEBUG: Seed 2 history snapshots for the first available match.
    Call this to test the history chart works.
    """
    from app.models.bets_db import save_odds_snapshots_batch
    import time as _time

    odds_data = await pinnacle_service.fetch_odds()
    if not odds_data:
        return {"error": "No odds available"}

    # Save first snapshot
    items_1 = [
        {
            "team_home": p.team_home,
            "team_away": p.team_away,
            "home_odds": p.home_odds,
            "draw_odds": p.draw_odds,
            "away_odds": p.away_odds,
            "league": p.league or "",
        }
        for p in odds_data[:20]
    ]
    await save_odds_snapshots_batch(items_1)
    logger.info(f"Seeded snapshot #1: {len(items_1)} items")

    # Tiny delay
    _time.sleep(1)

    # Save second snapshot with slightly tweaked odds
    items_2 = [
        {
            "team_home": p.team_home,
            "team_away": p.team_away,
            "home_odds": round(p.home_odds * 1.02, 2),
            "draw_odds": round(p.draw_odds * 0.98, 2),
            "away_odds": round(p.away_odds * 1.01, 2),
            "league": p.league or "",
        }
        for p in odds_data[:20]
    ]
    await save_odds_snapshots_batch(items_2)
    logger.info(f"Seeded snapshot #2: {len(items_2)} items")

    # Verify
    first = odds_data[0]
    history = await get_odds_history(first.team_home, first.team_away, limit=20)

    return {
        "seeded_matches": len(items_1),
        "test_match": f"{first.team_home} vs {first.team_away}",
        "history_points": len(history),
        "history": history,
    }
