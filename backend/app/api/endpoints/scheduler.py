"""
Scheduler API — automated odds collection and settlement.
Uses FastAPI BackgroundTasks to run periodic tasks.
Production: both Pinnacle (The Odds API) and Betman crawler triggers.
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import asyncio
from datetime import datetime, timezone

from app.services.pinnacle_api import pinnacle_service

router = APIRouter()
logger = logging.getLogger(__name__)


class SettleRequest(BaseModel):
    match_id: str
    winner: str  # "Home", "Draw", "Away"


class SettleResponse(BaseModel):
    match_id: str
    winner: str
    settled_count: int


# --- Betman state tracking ---
_betman_last_crawl: Optional[str] = None
_betman_last_count: int = 0
_betman_crawling: bool = False


@router.post("/collect_odds")
async def trigger_odds_collection(background_tasks: BackgroundTasks):
    """
    Manually trigger odds collection from The Odds API (Pinnacle replacement).
    Results are cached in Firestore for 5 minutes.
    """
    async def collect():
        try:
            odds = await pinnacle_service.refresh_odds()
            logger.info(f"Collected {len(odds)} odds items (force-fresh)")
        except Exception as e:
            logger.error(f"Collection failed: {e}")

    background_tasks.add_task(collect)
    return {
        "status": "Collection started",
        "source": "The Odds API (Pinnacle)",
        "api_key_present": bool(pinnacle_service.api_key),
        "requests_remaining": pinnacle_service._requests_remaining,
    }


@router.post("/collect_betman")
async def trigger_betman_collection(background_tasks: BackgroundTasks):
    """
    Manually trigger Betman crawler (프로토 승부식 배당 수집).
    Uses 3-tier strategy: Browser → HTTP JSON API → DB fallback.
    """
    global _betman_crawling, _betman_last_crawl, _betman_last_count

    if _betman_crawling:
        return {"status": "Already crawling", "last_crawl": _betman_last_crawl}

    def crawl():
        global _betman_crawling, _betman_last_crawl, _betman_last_count
        _betman_crawling = True
        try:
            from app.services.crawler_betman import BetmanCrawler
            crawler = BetmanCrawler()
            items = crawler.fetch_odds()
            _betman_last_count = len(items)
            _betman_last_crawl = datetime.now(timezone.utc).isoformat()
            logger.info(f"✅ Betman crawl complete: {len(items)} matches")
        except Exception as e:
            logger.error(f"Betman crawl failed: {e}")
        finally:
            _betman_crawling = False

    background_tasks.add_task(crawl)
    return {
        "status": "Betman crawl started",
        "last_crawl": _betman_last_crawl,
        "last_count": _betman_last_count,
    }


@router.post("/collect_all")
async def trigger_all_collection(background_tasks: BackgroundTasks):
    """
    Trigger both Pinnacle and Betman data collection simultaneously.
    Use this for full data refresh before round starts.
    """
    global _betman_crawling

    # Pinnacle (async)
    async def collect_pinnacle():
        try:
            odds = await pinnacle_service.refresh_odds()
            logger.info(f"Pinnacle: {len(odds)} items collected")
        except Exception as e:
            logger.error(f"Pinnacle collection failed: {e}")

    # Betman (sync in executor)
    def collect_betman():
        global _betman_crawling, _betman_last_crawl, _betman_last_count
        if _betman_crawling:
            return
        _betman_crawling = True
        try:
            from app.services.crawler_betman import BetmanCrawler
            crawler = BetmanCrawler()
            items = crawler.fetch_odds()
            _betman_last_count = len(items)
            _betman_last_crawl = datetime.now(timezone.utc).isoformat()
            logger.info(f"Betman: {len(items)} matches collected")
        except Exception as e:
            logger.error(f"Betman collection failed: {e}")
        finally:
            _betman_crawling = False

    background_tasks.add_task(collect_pinnacle)
    background_tasks.add_task(collect_betman)

    return {
        "status": "Full collection started (Pinnacle + Betman)",
        "pinnacle_api_key": bool(pinnacle_service.api_key),
        "betman_crawling": _betman_crawling,
    }


@router.post("/settle", response_model=SettleResponse)
async def trigger_settlement(req: SettleRequest):
    """
    Manually settle a match — grade all predictions.
    In production, this would be triggered by a webhook or scheduled check.
    """
    from app.services.settlement import settle_match

    if req.winner not in ("Home", "Draw", "Away"):
        raise HTTPException(status_code=400, detail="Winner must be Home, Draw, or Away")

    count = await settle_match(req.match_id, req.winner)
    return SettleResponse(
        match_id=req.match_id,
        winner=req.winner,
        settled_count=count,
    )


_settle_last_run: Optional[str] = None
_settle_last_result: Optional[dict] = None


@router.post("/auto_settle")
async def auto_settle_results(background_tasks: BackgroundTasks):
    """
    Manually trigger auto-settlement of all pending betting slips.
    Also runs automatically via Firebase Cloud Scheduler every 6 hours.
    (00:00, 06:00, 12:00, 18:00 KST)
    """
    global _settle_last_run, _settle_last_result

    async def settle():
        global _settle_last_run, _settle_last_result
        try:
            from app.services.settlement import auto_settle_slips
            result = await auto_settle_slips()
            _settle_last_run = datetime.now(timezone.utc).isoformat()
            _settle_last_result = result
            logger.info(f"Auto-settlement result: {result}")
        except Exception as e:
            logger.error(f"Auto-settlement failed: {e}")

    background_tasks.add_task(settle)
    return {
        "status": "Auto-settlement started",
        "message": "Checking all PENDING slips against latest scores",
        "schedule": "Every 6 hours (00:00, 06:00, 12:00, 18:00 KST)",
        "last_run": _settle_last_run,
    }


@router.get("/status")
async def get_scheduler_status():
    """Get current status of all data sources, scheduler, and settlement."""
    # Try to get last scheduled run from Firestore
    last_scheduled_run = None
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        doc = db.collection("system_logs").document("auto_settle_last_run").get()
        if doc.exists:
            data = doc.to_dict()
            last_scheduled_run = {
                "timestamp": data.get("timestamp", "").isoformat() if hasattr(data.get("timestamp", ""), "isoformat") else str(data.get("timestamp", "")),
                "result": data.get("result"),
                "trigger": data.get("trigger", "unknown"),
            }
    except Exception:
        pass

    return {
        "pinnacle": {
            "api_key_configured": bool(pinnacle_service.api_key),
            "requests_remaining": pinnacle_service._requests_remaining,
            "requests_used": pinnacle_service._requests_used,
            "target_sports": pinnacle_service.target_sports,
        },
        "betman": {
            "last_crawl": _betman_last_crawl,
            "last_match_count": _betman_last_count,
            "currently_crawling": _betman_crawling,
        },
        "settlement": {
            "schedule": "Every 6 hours (00:00, 06:00, 12:00, 18:00 KST)",
            "manual_last_run": _settle_last_run,
            "manual_last_result": _settle_last_result,
            "scheduled_last_run": last_scheduled_run,
        },
    }


