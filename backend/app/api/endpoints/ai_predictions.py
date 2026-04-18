"""
AI 승리예상 분석 API 엔드포인트
- 전체 경기 AI 예측 목록
- 개별 경기 상세 분석
- 데이터 소스 수집 트리거
"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone
import logging
import asyncio

from app.core.ai_predictor import AIPredictor
from app.core.ml_predictor import ml_predictor
from app.services.football_stats_service import FootballStatsService
from app.services.league_standings_service import LeagueStandingsService
from app.services.basketball_stats_service import BasketballStatsService
from app.services.live_score_api_service import LiveScoreApiService
from app.services.pinnacle_api import pinnacle_service
from app.schemas.predictions import MatchPrediction, PredictionResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Lazy-init singletons (Cold Start 최적화) ───
# 서버가 먼저 뜬 후, 첫 요청 시에만 초기화
_services_initialized = False
football_stats = None
league_standings = None
basketball_stats = None
live_score_api = None
ai_predictor = None

def _ensure_services():
    global _services_initialized, football_stats, league_standings, basketball_stats, live_score_api, ai_predictor
    if not _services_initialized:
        football_stats = FootballStatsService()
        league_standings = LeagueStandingsService()
        basketball_stats = BasketballStatsService()
        live_score_api = LiveScoreApiService()
        ai_predictor = AIPredictor()
        _services_initialized = True

# Cache for predictions
_predictions_cache: list = []
_last_prediction_time: str = ""


@router.get("/predictions")
async def get_ai_predictions(background_tasks: BackgroundTasks):
    """전체 경기 AI 예측 목록 (Firestore daily_portfolios 우선, 폴백: 실시간 추론)"""
    global _predictions_cache, _last_prediction_time
    from app.db.firestore import get_firestore_db
    from datetime import datetime, timezone
    
    # 1. 1순위: Firestore daily_portfolios 단일 읽기 (비용 최적화)
    db = get_firestore_db()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    try:
        doc_ref = db.collection("daily_portfolios").document(today_str)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            matches = data.get("matches", [])
            _predictions_cache = matches
            _last_prediction_time = data.get("updated_at", datetime.now(timezone.utc).isoformat())
            
            logger.info(f"📊 Serving {len(matches)} predictions from daily_portfolios")
            return PredictionResponse(
                predictions=matches,
                last_updated=_last_prediction_time,
                data_sources=["Firestore (daily_portfolios)", "LightGBM ML Engine"],
            ).model_dump()
    except Exception as e:
        logger.warning(f"daily_portfolios read failed: {e}")

    # 2. 2순위: 데이터가 없는 경우 실시간 추론 (Cold Start)
    logger.info("daily_portfolios not found. Falling back to real-time inference.")
    odds_data = await pinnacle_service.fetch_odds()
    if not odds_data:
        return PredictionResponse(
            predictions=[],
            last_updated=_last_prediction_time,
            data_sources=["데이터 수집 중... 잠시 후 새로고침해주세요"],
        ).model_dump()

    from app.services.ml_service import ml_inference_service
    matches_dict = [m.model_dump() if hasattr(m, 'model_dump') else m.__dict__ for m in odds_data]
    
    soccer_matches = [m for m in matches_dict if m.get("sport", "Soccer").lower() == "soccer"]
    baseball_matches = [m for m in matches_dict if m.get("sport", "Soccer").lower() == "baseball"]
    
    from app.services.soccer_stats_service import soccer_stats_service
    
    soccer_teams = set()
    for m in soccer_matches:
        if m.get("team_home"): soccer_teams.add(m.get("team_home"))
        if m.get("team_away"): soccer_teams.add(m.get("team_away"))
        
    stats_db = await soccer_stats_service.fetch_team_stats(list(soccer_teams))
    soccer_preds = ml_inference_service.predict_matches("soccer", soccer_matches, stats_db)
    baseball_preds = ml_inference_service.predict_matches("baseball", baseball_matches, stats_db)
    
    predictions = soccer_preds + baseball_preds
    
    # Fallback to odds-only if ML fails to produce results
    if not predictions:
        for odds in odds_data:
            imp_h = 1 / odds.home_odds if odds.home_odds > 0 else 0
            imp_d = 1 / odds.draw_odds if odds.draw_odds > 0 else 0
            imp_a = 1 / odds.away_odds if odds.away_odds > 0 else 0
            total_imp = imp_h + imp_d + imp_a
            if total_imp <= 0: continue
            
            h_pct = round((imp_h / total_imp) * 100, 1)
            d_pct = round((imp_d / total_imp) * 100, 1)
            a_pct = round((imp_a / total_imp) * 100, 1)
            best = max(h_pct, d_pct, a_pct)
            
            predictions.append({
                "match_id": f"{odds.team_home}_{odds.team_away}",
                "team_home": odds.team_home,
                "team_away": odds.team_away,
                "team_home_ko": odds.team_home_ko,
                "team_away_ko": odds.team_away_ko,
                "league": odds.league or "",
                "sport": odds.sport or "Soccer",
                "match_time": odds.match_time,
                "confidence": round(best, 1),
                "recommendation": "HOME" if best == h_pct else "AWAY" if best == a_pct else "DRAW",
                "home_win_prob": h_pct,
                "draw_prob": d_pct,
                "away_win_prob": a_pct,
                "factors": [{"name": "배당률 내재 확률", "weight": 100, "score": best, "detail": f"홈 {h_pct}% / 원정 {a_pct}%"}]
            })

    # Sort by confidence
    predictions.sort(key=lambda p: p.get("confidence", 0), reverse=True)
    _predictions_cache = predictions
    _last_prediction_time = datetime.now(timezone.utc).isoformat()

    # Async Update Firestore daily_portfolios to avoid missing next time
    try:
        def bg_update():
            try:
                db_ref = get_firestore_db().collection("daily_portfolios").document(today_str)
                db_ref.set({
                    "date": today_str,
                    "updated_at": _last_prediction_time,
                    "matches": predictions
                }, merge=True)
                logger.info(f"Background: saved {len(predictions)} matches to daily_portfolios")
            except Exception as e_bg:
                logger.error(f"Background save failed: {e_bg}")
        background_tasks.add_task(bg_update)
    except Exception as e_task:
        logger.warning(f"Could not add background task: {e_task}")

    sources = ["LightGBM ML Engine (Real-time fallback)"]
    if football_stats and getattr(football_stats, 'api_key', None):
        sources.append("API-Football")
        
    return PredictionResponse(
        predictions=predictions,
        last_updated=_last_prediction_time,
        data_sources=sources,
    ).model_dump()


async def _save_predictions_background(pred_dicts: list):
    """Background task to save AI predictions to Firestore."""
    try:
        from app.models.prediction_db import save_ai_predictions_batch
        saved = await save_ai_predictions_batch(pred_dicts)
        if saved > 0:
            logger.info(f"📊 Background: saved {saved} AI predictions to Firestore")
    except Exception as e:
        logger.error(f"Background AI prediction save error: {e}")


@router.get("/predictions/{match_id}")
async def get_match_prediction(match_id: str):
    """개별 경기 AI 상세 분석 (ML 모델 우선)"""
    global _predictions_cache
    _ensure_services()

    # 1. 1순위: 메모리 캐시 확인
    for pred in _predictions_cache:
        pid = pred.match_id if hasattr(pred, 'match_id') else pred.get('match_id', '')
        if pid == match_id:
            return pred.model_dump() if hasattr(pred, 'model_dump') else pred

    # 2. 2순위: 캐시가 없다면 Firestore daily_portfolios에서 단건 조회용으로 전체 로드 시도 (콜드스타트 방어)
    try:
        from app.db.firestore import get_firestore_db
        from datetime import datetime, timezone
        db = get_firestore_db()
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        doc_ref = db.collection("daily_portfolios").document(today_str)
        doc = doc_ref.get()
        if doc.exists:
            matches = doc.to_dict().get("matches", [])
            _predictions_cache = matches  # 메모리에 캐싱
            for pred in matches:
                if pred.get("match_id") == match_id:
                    logger.info(f"Loaded {match_id} from daily_portfolios on demand.")
                    return pred
    except Exception as e:
        logger.warning(f"daily_portfolios read failed in get_match_prediction: {e}")

    # 3. 3순위: Firestore에도 없다면 개별 실시간 추론 (Fallback)
    odds_data = await pinnacle_service.fetch_odds()
    for odds in odds_data:
        mid = f"{odds.team_home}_{odds.team_away}"
        if mid == match_id:
            if ml_predictor.is_ml_ready:
                ml_result = await ml_predictor.predict(
                    home_team=odds.team_home,
                    away_team=odds.team_away,
                    league=odds.league or "",
                    home_odds=odds.home_odds,
                    draw_odds=odds.draw_odds,
                    away_odds=odds.away_odds,
                )
                return ml_result
            else:
                pred = ai_predictor.predict_match(odds)
                return pred.model_dump()

    raise HTTPException(status_code=404, detail="Match not found")


@router.post("/collect-stats")
async def trigger_stats_collection():
    """외부 데이터 소스 수집 트리거 (스케줄러 or 수동)"""
    _ensure_services()
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
    _ensure_services()
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


@router.get("/standings-all")
async def get_all_standings():
    """전체 리그 순위표 (프론트 순위표 페이지용)"""
    _ensure_services()
    all_standings = {}

    # AI predictor cache (API-Football 수집 데이터)
    for league_key, teams in ai_predictor._standings_cache.items():
        all_standings[league_key] = [
            t.model_dump() if hasattr(t, 'model_dump') else t for t in teams
        ]

    # league_standings service cache (football-data.org) — 빠진 리그 보충
    cached = league_standings.get_cached()
    for league_key, teams in cached.items():
        if league_key not in all_standings:
            all_standings[league_key] = teams

    return {
        "leagues": all_standings,
        "total_leagues": len(all_standings),
    }


@router.get("/match-detail/{match_id}")
async def get_match_detail(match_id: str):
    """경기 클릭 시 종합 상세 정보 반환 (순위, 폼, 최근경기, 라인업, 부상)"""
    _ensure_services()
    parts = match_id.split("_", 1)
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid match_id format. Use team_home_team_away")

    # match_id could be "team home_team away" with underscores in team names
    # Find from cached odds
    odds_data = await pinnacle_service.fetch_odds()
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
    _ensure_services()
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
    - Live-Score-Api 우선 사용 (600 req/hr, 30초 캐시)
    - API-Football은 fallback
    - ?league=soccer_epl 로 특정 리그 필터 가능
    """
    _ensure_services()
    source = "none"

    # 1차: Live-Score-Api (600 req/hr 무료)
    if live_score_api.is_available:
        try:
            matches = await live_score_api.fetch_live_scores()
            cache = live_score_api.get_live_cache()
            source = "live-score-api"

            # league 필터 (기존 호환: league_name 기반 부분 매칭)
            if league and matches:
                from app.services.football_stats_service import LEAGUE_MAP
                league_id = LEAGUE_MAP.get(league)
                # Live-Score-Api는 competition_id 사용, league_name으로도 필터
                filtered = []
                for m in matches:
                    if league_id and m.get("league_id") == league_id:
                        filtered.append(m)
                    elif league and league.replace("soccer_", "").replace("_", " ").lower() in m.get("league_name", "").lower():
                        filtered.append(m)
                matches = filtered

            stats = live_score_api.get_stats()
            return {
                "matches": matches,
                "live_count": len(matches),
                "total_live": len(cache.get("matches", [])),
                "updated_at": cache.get("updated_at", ""),
                "source": source,
                "api_used": stats.get("hourly_requests", 0),
                "api_limit": stats.get("hourly_limit", 600),
            }
        except Exception as e:
            logger.warning(f"Live-Score-Api error, falling back: {e}")

    # 2차: API-Football fallback (100 req/day)
    if football_stats.api_key:
        try:
            matches = await football_stats.fetch_live_scores(league_key=league)
            cache = football_stats.get_live_cache()
            source = "api-football"
            return {
                "matches": matches,
                "live_count": len(matches),
                "total_live": len(cache.get("matches", [])),
                "updated_at": cache.get("updated_at", ""),
                "source": source,
                "api_used": football_stats._daily_requests,
                "api_limit": football_stats._daily_limit,
            }
        except Exception as e:
            logger.error(f"API-Football live scores error: {e}")

    return {"matches": [], "message": "No live score API configured", "live_count": 0, "source": source}


@router.get("/live-scores/{match_id}/events")
async def get_match_events(match_id: int):
    """경기 이벤트 조회 (골, 카드, 교체)
    - Live-Score-Api 전용
    """
    if not live_score_api.is_available:
        raise HTTPException(status_code=503, detail="Live-Score-Api not configured")

    try:
        result = await live_score_api.fetch_match_events(match_id)
        if not result:
            return {"match_id": match_id, "events": [], "count": 0}
        return result
    except Exception as e:
        logger.error(f"Match events error: {e}")
        return {"match_id": match_id, "events": [], "count": 0, "error": str(e)}


@router.get("/live-scores/{match_id}/lineups")
async def get_match_lineups(match_id: int):
    """경기 라인업 조회
    - Live-Score-Api 전용 (5분 캐시)
    """
    if not live_score_api.is_available:
        raise HTTPException(status_code=503, detail="Live-Score-Api not configured")

    try:
        result = await live_score_api.fetch_match_lineups(match_id)
        if not result:
            return {"match_id": match_id, "lineups": {}}
        return result
    except Exception as e:
        logger.error(f"Match lineups error: {e}")
        return {"match_id": match_id, "lineups": {}, "error": str(e)}


@router.get("/match-list")
async def get_match_list():
    """SEO 빌드 시 정적 경기 페이지 생성용 — 모든 경기 요약 반환"""
    import re
    odds_data = await pinnacle_service.fetch_odds()
    if not odds_data:
        return {"matches": [], "generated_at": ""}

    matches = []
    for odds in odds_data:
        # Generate URL-safe slug from team names
        def to_slug(name: str) -> str:
            s = name.lower().strip()
            s = re.sub(r'[^a-z0-9\s-]', '', s)
            s = re.sub(r'[\s]+', '-', s)
            return s.strip('-') or 'team'

        # Extract date from match_time
        match_date = ""
        if odds.match_time:
            try:
                from datetime import datetime as dt
                parsed = dt.fromisoformat(odds.match_time.replace('Z', '+00:00'))
                match_date = parsed.strftime("%Y-%m-%d")
            except Exception:
                match_date = odds.match_time[:10] if len(odds.match_time) >= 10 else ""

        home_slug = to_slug(odds.team_home)
        away_slug = to_slug(odds.team_away)
        match_slug = f"{home_slug}-vs-{away_slug}"

        # Implied probabilities from odds
        imp_h = (1 / odds.home_odds * 100) if odds.home_odds > 0 else 0
        imp_d = (1 / odds.draw_odds * 100) if odds.draw_odds > 0 else 0
        imp_a = (1 / odds.away_odds * 100) if odds.away_odds > 0 else 0
        total = imp_h + imp_d + imp_a
        if total > 0:
            imp_h = round(imp_h / total * 100, 1)
            imp_d = round(imp_d / total * 100, 1)
            imp_a = round(imp_a / total * 100, 1)

        matches.append({
            "date": match_date,
            "slug": match_slug,
            "match_id": f"{odds.team_home}_{odds.team_away}",
            "home": odds.team_home,
            "away": odds.team_away,
            "home_ko": odds.team_home_ko or odds.team_home,
            "away_ko": odds.team_away_ko or odds.team_away,
            "league": odds.league or "",
            "sport": odds.sport or "Soccer",
            "match_time": odds.match_time or "",
            "home_odds": odds.home_odds,
            "draw_odds": odds.draw_odds,
            "away_odds": odds.away_odds,
            "home_prob": imp_h,
            "draw_prob": imp_d,
            "away_prob": imp_a,
        })

    from datetime import datetime, timezone
    return {
        "matches": matches,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/data-sources")
async def get_data_sources_status():
    """데이터 소스 상태 확인"""
    _ensure_services()
    live_stats = live_score_api.get_stats()
    return {
        "the_odds_api": {
            "status": "active" if pinnacle_service.api_key else "no_key",
            "description": "배당률 (H2H Odds)",
        },
        "live_score_api": {
            "status": "active" if live_score_api.is_available else "no_key",
            "description": "실시간 라이브 스코어, 이벤트, 라인업 (600 req/hr)",
            "hourly_limit": live_stats.get("hourly_limit", 600),
            "hourly_used": live_stats.get("hourly_requests", 0),
        },
        "api_football": {
            "status": "active" if football_stats.api_key else "no_key",
            "description": "팀통계, H2H, 부상, AI예측 (fallback 라이브)",
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


@router.get("/accuracy")
async def get_ai_accuracy(
    days: int = Query(default=30, ge=1, le=365),
    league: Optional[str] = None,
):
    """AI 적중률 통계 (무료: 요약만, Pro: 상세)"""
    from app.models.prediction_db import get_ai_accuracy_stats
    stats = await get_ai_accuracy_stats(days=days, league=league)
    return {
        "status": "ok",
        **stats,
    }


@router.get("/prediction-history")
async def get_prediction_history(
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = None,
):
    """AI 예측 이력 (Pro 이상 접근)"""
    from app.models.prediction_db import get_recent_ai_predictions
    records = await get_recent_ai_predictions(limit=limit, status=status)

    # Serialize datetime objects for JSON response
    for r in records:
        for key in ["created_at", "graded_at"]:
            if r.get(key) and hasattr(r[key], "isoformat"):
                r[key] = r[key].isoformat()

    return {
        "status": "ok",
        "predictions": records,
        "count": len(records),
    }


@router.post("/grade-predictions")
async def trigger_grade_predictions():
    """수동 적중률 판정 트리거 (스케줄러에서 자동 호출 가능)"""
    _ensure_services()
    from app.models.prediction_db import grade_ai_predictions, get_recent_ai_predictions

    # PENDING 상태인 예측 중 경기가 끝난 것들 가져오기
    pending = await get_recent_ai_predictions(limit=100, status="PENDING")
    if not pending:
        return {"status": "ok", "message": "No pending predictions", "graded": 0}

    # API-Football에서 완료된 경기 결과 가져오기
    results = []
    if football_stats and football_stats.api_key:
        try:
            finished = await football_stats.fetch_finished_fixtures(days_back=3)
            for fix in finished:
                home = fix.get("teams", {}).get("home", {})
                away = fix.get("teams", {}).get("away", {})
                goals = fix.get("goals", {})
                match_id = f"{home.get('name', '')}_{away.get('name', '')}"
                results.append({
                    "match_id": match_id,
                    "home_score": goals.get("home"),
                    "away_score": goals.get("away"),
                })
        except Exception as e:
            logger.error(f"Fetch finished fixtures error: {e}")

    if not results:
        return {"status": "ok", "message": "No finished fixtures found", "graded": 0}

    graded = await grade_ai_predictions(results)
    return {
        "status": "ok",
        "graded": graded,
        "total_results_checked": len(results),
    }

