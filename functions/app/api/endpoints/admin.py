"""
관리자 API — 시스템 설정 + 베트맨 데이터 CRUD
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# System Config (기존)
# ─────────────────────────────────────────────

class SystemConfigSchema(BaseModel):
    pinnacle_api_key: str
    betman_user_agent: str
    scrape_interval_minutes: int
    class Config:
        orm_mode = True


@router.get("/config", response_model=SystemConfigSchema)
async def get_system_config():
    return {
        "pinnacle_api_key": "YOUR_API_KEY",
        "betman_user_agent": "Mozilla/5.0",
        "scrape_interval_minutes": 60,
    }


@router.post("/config", response_model=SystemConfigSchema)
async def update_system_config(new_config: SystemConfigSchema):
    return new_config


# ─────────────────────────────────────────────
# Betman 크롤링 + CRUD
# ─────────────────────────────────────────────

class BetmanMatchUpdate(BaseModel):
    team_home: Optional[str] = None
    team_away: Optional[str] = None
    home_odds: Optional[float] = None
    draw_odds: Optional[float] = None
    away_odds: Optional[float] = None
    sport: Optional[str] = None
    league: Optional[str] = None
    match_time: Optional[str] = None


class BetmanMatchCreate(BaseModel):
    team_home: str
    team_away: str
    home_odds: float
    draw_odds: float = 0.0
    away_odds: float = 0.0
    sport: str = "Soccer"
    league: str = ""
    match_time: str = ""


# --- 상태 조회 ---
@router.get("/betman/status")
async def betman_status():
    """베트맨 크롤러 상태 및 저장된 데이터 통계"""
    from app.models.betman_db import get_betman_status
    return get_betman_status()


# --- 크롤링 수동 실행 ---
@router.post("/betman/crawl")
async def betman_crawl():
    """
    베트맨 크롤링 수동 실행.
    성공 시 데이터가 자동 저장됩니다.
    """
    from app.services.crawler_betman import BetmanCrawler

    crawler = BetmanCrawler()
    loop = asyncio.get_event_loop()
    items = await loop.run_in_executor(None, crawler.fetch_odds)

    if items:
        return {
            "success": True,
            "message": f"크롤링 완료: {len(items)}개 경기",
            "count": len(items),
            "source": "crawl" if crawler.last_round_id else "saved_db",
            "round_id": crawler.last_round_id,
            "matches": [
                {
                    "team_home": i.team_home,
                    "team_away": i.team_away,
                    "home_odds": i.home_odds,
                    "draw_odds": i.draw_odds,
                    "away_odds": i.away_odds,
                    "sport": i.sport,
                    "league": i.league,
                }
                for i in items[:5]  # Preview first 5
            ],
        }
    else:
        return {
            "success": False,
            "message": "크롤링 실패 — 베트맨 접속 차단 or 판매중인 경기 없음",
            "count": 0,
        }


class BetmanPushPayload(BaseModel):
    round_id: str
    matches: List[dict]


# --- 로컬 크롤링 데이터 푸시 ---
@router.post("/betman/push")
async def betman_push(payload: BetmanPushPayload):
    """
    로컬에서 크롤링한 데이터를 Firestore에 저장.
    GCP에서 베트맨 접근이 차단되므로, 로컬 크롤러가 이 엔드포인트로 데이터를 푸시합니다.
    """
    from app.models.betman_db import save_betman_round
    
    if not payload.matches:
        return {"success": False, "message": "No matches to save", "count": 0}
    
    count = save_betman_round(payload.round_id, payload.matches)
    return {
        "success": True,
        "message": f"Saved {count} matches for round {payload.round_id}",
        "count": count,
        "round_id": payload.round_id,
    }


# --- 회차 목록 ---
@router.get("/betman/rounds")
async def betman_rounds():
    """저장된 베트맨 회차 목록"""
    from app.models.betman_db import get_betman_rounds
    return get_betman_rounds()


# --- 경기 목록 조회 ---
@router.get("/betman/matches")
async def betman_matches(round_id: Optional[str] = None):
    """
    베트맨 경기 목록 조회.
    round_id를 지정하지 않으면 최신 회차 반환.
    """
    from app.models.betman_db import get_betman_matches
    matches = get_betman_matches(round_id)
    return {
        "round_id": round_id or "latest",
        "count": len(matches),
        "matches": matches,
    }


# --- 경기 수동 수정 ---
@router.put("/betman/matches/{match_id}")
async def betman_update_match(match_id: str, updates: BetmanMatchUpdate):
    """
    경기 정보 수동 수정 (배당률, 팀명, 리그 등).
    크롤링 결과가 잘못된 경우 관리자가 직접 수정.
    """
    from app.models.betman_db import update_betman_match

    update_dict = updates.dict(exclude_none=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="수정할 필드가 없습니다")

    result = update_betman_match(match_id, update_dict)
    if result:
        return {
            "success": True,
            "message": f"경기 {match_id} 수정 완료",
            "match": result,
        }
    raise HTTPException(status_code=404, detail=f"경기 {match_id}를 찾을 수 없습니다")


# --- 경기 삭제 ---
@router.delete("/betman/matches/{match_id}")
async def betman_delete_match(match_id: str):
    """경기 삭제 (잘못 크롤링된 경기 제거)"""
    from app.models.betman_db import delete_betman_match

    if delete_betman_match(match_id):
        return {"success": True, "message": f"경기 {match_id} 삭제 완료"}
    raise HTTPException(status_code=404, detail=f"경기 {match_id}를 찾을 수 없습니다")


# --- 경기 수동 추가 ---
@router.post("/betman/matches")
async def betman_add_match(match: BetmanMatchCreate, round_id: Optional[str] = None):
    """
    경기 수동 추가.
    크롤링에 빠진 경기를 관리자가 직접 추가.
    """
    from app.models.betman_db import add_betman_match

    match_data = match.dict()
    result = add_betman_match(match_data, round_id)
    return {
        "success": True,
        "message": "경기 추가 완료",
        "match": result,
    }
