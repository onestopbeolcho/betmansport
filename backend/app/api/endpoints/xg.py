"""
xG API 엔드포인트 — Understat xG 데이터 조회.
Phase 1: 별도 라우터로 추가 (기존 라우터에 영향 없음)
Phase 2 (배포 시): main.py에 router include 추가

테스트용:
  GET /api/xg/status        → 서비스 상태
  GET /api/xg/league/{key}  → 리그별 팀 xG 데이터
  GET /api/xg/team/{name}   → 특정 팀 xG
  POST /api/xg/collect      → 전체 리그 xG 수집 트리거
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
import logging

from app.services.understat_xg_service import understat_service, UNDERSTAT_LEAGUES

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status")
async def xg_status():
    """xG 서비스 상태 조회."""
    return understat_service.get_status()


@router.get("/league/{league_key}")
async def xg_league(league_key: str):
    """
    리그별 팀 xG 통계.
    
    league_key: soccer_epl, soccer_spain_la_liga, 등
    """
    # 캐시에 있으면 바로 반환
    cached = understat_service.get_cached()
    if league_key in cached:
        return {
            "league": league_key,
            "teams_count": len(cached[league_key]),
            "data": cached[league_key],
        }

    # 캐시 없으면 수집
    understat_league = None
    for ustat_key, internal_key in UNDERSTAT_LEAGUES.items():
        if internal_key == league_key:
            understat_league = ustat_key
            break

    if not understat_league:
        raise HTTPException(
            status_code=404,
            detail=f"Unsupported league: {league_key}. Available: {list(UNDERSTAT_LEAGUES.values())}"
        )

    teams = await understat_service.fetch_league_teams_xg(understat_league)
    if not teams:
        raise HTTPException(status_code=502, detail=f"Failed to fetch xG data for {league_key}")

    return {
        "league": league_key,
        "teams_count": len(teams),
        "data": teams,
    }


@router.get("/team/{team_name}")
async def xg_team(team_name: str, league: str = "soccer_epl"):
    """특정 팀의 xG 통계 (부분 이름 매칭)."""
    stats = await understat_service.get_team_xg(team_name, league)
    if not stats:
        raise HTTPException(
            status_code=404,
            detail=f"Team '{team_name}' not found in {league}"
        )
    return {
        "team": team_name,
        "league": league,
        "xg_stats": stats,
    }


@router.get("/matches/{league_key}")
async def xg_matches(league_key: str, limit: int = 20):
    """리그 최근 경기 xG 데이터."""
    understat_league = None
    for ustat_key, internal_key in UNDERSTAT_LEAGUES.items():
        if internal_key == league_key:
            understat_league = ustat_key
            break

    if not understat_league:
        raise HTTPException(status_code=404, detail=f"Unsupported league: {league_key}")

    matches = await understat_service.fetch_match_xg(understat_league)
    return {
        "league": league_key,
        "total_matches": len(matches),
        "recent": matches[-limit:] if matches else [],
    }


@router.post("/collect")
async def xg_collect(background_tasks: BackgroundTasks):
    """전체 리그 xG 데이터 수집 (백그라운드)."""
    async def _collect():
        try:
            result = await understat_service.collect_all_leagues()
            logger.info(f"✅ xG collection complete: {len(result)} leagues")
        except Exception as e:
            logger.error(f"xG collection error: {e}")

    background_tasks.add_task(_collect)
    return {
        "status": "collecting",
        "leagues": list(UNDERSTAT_LEAGUES.values()),
    }
