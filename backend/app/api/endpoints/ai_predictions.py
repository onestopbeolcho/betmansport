"""
AI 승리예상 분석 API 엔드포인트
- 전체 경기 AI 예측 목록
- 개별 경기 상세 분석
- 데이터 소스 수집 트리거
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone
import logging

from app.core.ai_predictor import AIPredictor
from app.services.football_stats_service import FootballStatsService
from app.services.league_standings_service import LeagueStandingsService
from app.services.basketball_stats_service import BasketballStatsService
from app.services.pinnacle_api import pinnacle_service
from app.schemas.predictions import MatchPrediction, PredictionResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Singleton services
football_stats = FootballStatsService()
league_standings = LeagueStandingsService()
basketball_stats = BasketballStatsService()
ai_predictor = AIPredictor()

# Cache for predictions
_predictions_cache: list = []
_last_prediction_time: str = ""


@router.get("/predictions")
async def get_ai_predictions():
    """전체 경기 AI 예측 목록"""
    global _predictions_cache, _last_prediction_time

    # Use cached odds from pinnacle_service
    odds_data = pinnacle_service.get_cached_odds()
    if not odds_data:
        return PredictionResponse(
            predictions=[],
            last_updated=_last_prediction_time,
            data_sources=["No odds data available"],
        ).model_dump()

    # Run predictions
    predictions = ai_predictor.predict_all(odds_data)
    _predictions_cache = predictions
    _last_prediction_time = datetime.now(timezone.utc).isoformat()

    # Determine active data sources
    sources = ["The Odds API (배당률)"]
    if football_stats.api_key:
        sources.append("API-Football (팀통계/부상)")
    if league_standings.api_key:
        sources.append("football-data.org (리그순위)")
    if basketball_stats.api_key:
        sources.append("API-Basketball (NBA)")

    return PredictionResponse(
        predictions=[p.model_dump() for p in predictions],
        last_updated=_last_prediction_time,
        data_sources=sources,
    ).model_dump()


@router.get("/predictions/{match_id}")
async def get_match_prediction(match_id: str):
    """개별 경기 AI 상세 분석"""
    # Find in cache
    for pred in _predictions_cache:
        if pred.match_id == match_id:
            return pred.model_dump()

    # Try to compute on the fly
    odds_data = pinnacle_service.get_cached_odds()
    for odds in odds_data:
        mid = f"{odds.team_home}_{odds.team_away}"
        if mid == match_id:
            pred = ai_predictor.predict_match(odds)
            return pred.model_dump()

    raise HTTPException(status_code=404, detail="Match not found")


@router.post("/collect-stats")
async def trigger_stats_collection():
    """외부 데이터 소스 수집 트리거 (스케줄러 or 수동)"""
    results = {"football": {}, "standings": {}, "basketball": {}}

    # 1. API-Football (팀통계, 부상, 예측)
    try:
        fb_data = await football_stats.collect_all()
        results["football"] = {
            "standings_leagues": len(fb_data.get("standings", {})),
            "injuries_leagues": len(fb_data.get("injuries", {})),
            "predictions_count": len(fb_data.get("predictions", [])),
        }
        # Update AI predictor with collected data
        from app.schemas.predictions import TeamStats
        standings_parsed = {}
        for league, teams in fb_data.get("standings", {}).items():
            standings_parsed[league] = [TeamStats(**t) for t in teams]
        ai_predictor.update_data(
            standings=standings_parsed,
            injuries=fb_data.get("injuries", {}),
            api_predictions=fb_data.get("predictions", []),
        )
    except Exception as e:
        logger.error(f"Football stats collection error: {e}")
        results["football"] = {"error": str(e)}

    # 2. football-data.org (리그 순위 — 무료)
    try:
        standings_data = await league_standings.collect_all()
        results["standings"] = {"leagues": len(standings_data)}
        # Merge standings if API-Football data missing
        from app.schemas.predictions import TeamStats
        for league, teams in standings_data.items():
            if league not in ai_predictor._standings_cache:
                ai_predictor._standings_cache[league] = [TeamStats(**t) for t in teams]
    except Exception as e:
        logger.error(f"League standings collection error: {e}")
        results["standings"] = {"error": str(e)}

    # 3. API-Basketball
    try:
        bball_data = await basketball_stats.collect_all()
        results["basketball"] = {"leagues": len(bball_data)}
    except Exception as e:
        logger.error(f"Basketball stats collection error: {e}")
        results["basketball"] = {"error": str(e)}

    return {
        "status": "ok",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }


@router.get("/standings/{sport}")
async def get_standings(sport: str):
    """리그 순위 조회"""
    # Try AI predictor cache first
    data = ai_predictor._standings_cache.get(sport)
    if data:
        return {
            "sport": sport,
            "standings": [t.model_dump() if hasattr(t, 'model_dump') else t for t in data],
        }

    # Try league_standings service cache
    cached = league_standings.get_cached()
    if sport in cached:
        return {"sport": sport, "standings": cached[sport]}

    return {"sport": sport, "standings": [], "message": "데이터 수집 필요 (/api/ai/collect-stats)"}


@router.get("/match-detail/{match_id}")
async def get_match_detail(match_id: str):
    """경기 클릭 시 종합 상세 정보 반환 (순위, 폼, 최근경기, 라인업, 부상)"""
    parts = match_id.split("_", 1)
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid match_id format. Use team_home_team_away")

    # match_id could be "team home_team away" with underscores in team names
    # Find from cached odds
    odds_data = pinnacle_service.get_cached_odds()
    target = None
    for odds in odds_data:
        mid = f"{odds.team_home}_{odds.team_away}"
        if mid == match_id:
            target = odds
            break

    if not target:
        raise HTTPException(status_code=404, detail="Match not found in odds cache")

    home_name = target.team_home
    away_name = target.team_away
    sport_key = target.sport_key if hasattr(target, 'sport_key') else ""

    result = {
        "match_id": match_id,
        "home": home_name,
        "away": away_name,
        "sport_key": sport_key,
        "standings": {"home": None, "away": None},
        "recent_matches": {"home": [], "away": []},
        "lineups": None,
        "injuries": {"home": [], "away": []},
    }

    # 1. Standings & Form — from cached data (no API call)
    for league_key, standings_list in ai_predictor._standings_cache.items():
        for team in standings_list:
            t_name = team.team_name if hasattr(team, 'team_name') else team.get("team_name", "")
            if t_name.lower() == home_name.lower() or home_name.lower() in t_name.lower() or t_name.lower() in home_name.lower():
                result["standings"]["home"] = team.model_dump() if hasattr(team, 'model_dump') else team
            if t_name.lower() == away_name.lower() or away_name.lower() in t_name.lower() or t_name.lower() in away_name.lower():
                result["standings"]["away"] = team.model_dump() if hasattr(team, 'model_dump') else team

    # Also check league_standings service cache
    if not result["standings"]["home"] or not result["standings"]["away"]:
        for league_key, teams_list in league_standings.get_cached().items():
            for team_data in teams_list:
                t_name = team_data.get("team_name", "")
                if not result["standings"]["home"] and (t_name.lower() == home_name.lower() or home_name.lower() in t_name.lower()):
                    result["standings"]["home"] = team_data
                if not result["standings"]["away"] and (t_name.lower() == away_name.lower() or away_name.lower() in t_name.lower()):
                    result["standings"]["away"] = team_data

    # 2. Recent matches — from football-data.org (cached, no extra API call needed)
    #    If we have sport_key, fetch from cache
    fb_cached = football_stats.get_cached()
    if fb_cached:
        # Pull from standings cache for form data (already have it)
        pass

    # 3. Injuries — from cached data
    injuries_cache = fb_cached.get("injuries", {}) if fb_cached else {}
    for league_key, injury_list in injuries_cache.items():
        for inj in injury_list:
            inj_team = inj.get("team_name", "")
            if inj_team.lower() == home_name.lower() or home_name.lower() in inj_team.lower():
                result["injuries"]["home"].append(inj)
            elif inj_team.lower() == away_name.lower() or away_name.lower() in inj_team.lower():
                result["injuries"]["away"].append(inj)

    # 4. Try to fetch live data (lineups, recent matches) if quota available 
    #    These use API-Football requests (limited to 100/day)
    if football_stats.api_key and football_stats._daily_requests < football_stats._daily_limit - 5:
        try:
            # Search team IDs
            home_id = await football_stats.search_team_id(home_name)
            away_id = await football_stats.search_team_id(away_name)

            # Recent matches for each team
            if home_id:
                result["recent_matches"]["home"] = await football_stats.fetch_team_last_matches(home_id, 5)
            if away_id:
                result["recent_matches"]["away"] = await football_stats.fetch_team_last_matches(away_id, 5)

            # Lineups (only available close to match time)
            if home_id and away_id:
                # Try to find fixture ID
                for league_key in ["soccer_epl", "soccer_spain_la_liga", "soccer_germany_bundesliga", 
                                   "soccer_italy_serie_a", "soccer_france_ligue_one", "soccer_uefa_champs_league"]:
                    fix_id = await football_stats.find_fixture_id(league_key, home_name, away_name)
                    if fix_id:
                        lineups = await football_stats.fetch_lineups(fix_id)
                        if lineups:
                            result["lineups"] = lineups
                        break
        except Exception as e:
            logger.warning(f"Match detail live fetch error: {e}")

    result["api_requests_used"] = football_stats._daily_requests
    result["api_requests_limit"] = football_stats._daily_limit

    return result


@router.get("/league-table/{league_key}")
async def get_league_table(league_key: str):
    """리그 전체 순위표 + 최근 경기 결과"""
    standings = []
    recent_matches = []

    # 1. Standings from caches
    if league_key in ai_predictor._standings_cache:
        standings = [t.model_dump() if hasattr(t, 'model_dump') else t 
                     for t in ai_predictor._standings_cache[league_key]]
    else:
        cached = league_standings.get_cached()
        if league_key in cached:
            standings = cached[league_key]

    # 2. Recent matches from football-data.org (free, no quota impact)
    if league_standings.api_key:
        try:
            recent_matches = await league_standings.fetch_recent_matches(league_key, limit=10)
        except Exception as e:
            logger.warning(f"Recent matches fetch error: {e}")

    # 3. Top scorers
    scorers = []
    if league_standings.api_key:
        try:
            scorers = await league_standings.fetch_scorers(league_key, limit=5)
        except Exception as e:
            logger.warning(f"Scorers fetch error: {e}")

    return {
        "league_key": league_key,
        "standings": standings,
        "recent_matches": recent_matches,
        "top_scorers": scorers,
    }


@router.get("/live-scores")
async def get_live_scores(league: Optional[str] = None):
    """실시간 진행 중인 경기 스코어 조회
    - 60초 캐시 적용 (API quota 최소 사용)
    - ?league=soccer_epl 로 특정 리그 필터 가능
    """
    if not football_stats.api_key:
        return {"matches": [], "message": "API-Football key not configured", "live_count": 0}

    try:
        matches = await football_stats.fetch_live_scores(league_key=league)
        cache = football_stats.get_live_cache()
        return {
            "matches": matches,
            "live_count": len(matches),
            "total_live": len(cache.get("matches", [])),
            "updated_at": cache.get("updated_at", ""),
            "api_used": football_stats._daily_requests,
            "api_limit": football_stats._daily_limit,
        }
    except Exception as e:
        logger.error(f"Live scores error: {e}")
        return {"matches": [], "error": str(e), "live_count": 0}


@router.get("/data-sources")
async def get_data_sources_status():
    """데이터 소스 상태 확인"""
    return {
        "the_odds_api": {
            "status": "active" if pinnacle_service.api_key else "no_key",
            "description": "배당률 (H2H Odds)",
        },
        "api_football": {
            "status": "active" if football_stats.api_key else "no_key",
            "description": "팀통계, H2H, 부상, AI예측, 라인업",
            "daily_limit": football_stats._daily_limit,
            "daily_used": football_stats._daily_requests,
        },
        "football_data_org": {
            "status": "active" if league_standings.api_key else "no_key",
            "description": "리그 순위, 득점자, 최근 경기 (무료)",
        },
        "api_basketball": {
            "status": "active" if basketball_stats.api_key else "no_key",
            "description": "NBA/유로리그 통계",
            "daily_limit": basketball_stats._daily_limit,
            "daily_used": basketball_stats._daily_requests,
        },
    }

