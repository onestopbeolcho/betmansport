"""
API-Football 연동 서비스
- 팀 통계, H2H 상대전적, 부상/결장, AI Predictions
- 무료 100건/일 → 하루 1회 배치 수집
- Docs: https://www.api-football.com/documentation-v3
"""
import httpx
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime, timezone
from app.schemas.predictions import TeamStats, H2HRecord, InjuryInfo

logger = logging.getLogger(__name__)

# API-Football league IDs
LEAGUE_MAP = {
    "soccer_epl": 39,
    "soccer_spain_la_liga": 140,
    "soccer_germany_bundesliga": 78,
    "soccer_italy_serie_a": 135,
    "soccer_france_ligue_one": 61,
    "soccer_uefa_champs_league": 2,
}

CURRENT_SEASON = 2025  # 2025-2026 시즌


class FootballStatsService:
    def __init__(self):
        self.api_key = os.getenv("API_FOOTBALL_KEY", "")
        self.base_url = "https://v3.football.api-sports.io"
        self._daily_requests = 0
        self._daily_limit = 100
        self._cache: Dict[str, any] = {}
        self._last_fetch: Optional[str] = None

        if self.api_key:
            logger.info("✅ API-Football key loaded")
        else:
            logger.warning("⚠️ No API_FOOTBALL_KEY — football stats unavailable")

    def _headers(self) -> Dict:
        return {
            "x-apisports-key": self.api_key,
            "x-rapidapi-host": "v3.football.api-sports.io",
        }

    def _can_request(self) -> bool:
        if not self.api_key:
            return False
        if self._daily_requests >= self._daily_limit:
            logger.warning(f"⚠️ API-Football daily limit reached ({self._daily_requests}/{self._daily_limit})")
            return False
        return True

    async def _get(self, endpoint: str, params: Dict) -> Optional[Dict]:
        """API 요청 + rate limit tracking"""
        if not self._can_request():
            return None
        url = f"{self.base_url}/{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
                self._daily_requests += 1

                if resp.status_code != 200:
                    logger.warning(f"API-Football {endpoint}: HTTP {resp.status_code}")
                    return None

                data = resp.json()
                errors = data.get("errors", {})
                if errors:
                    logger.warning(f"API-Football errors: {errors}")
                    return None

                remaining = data.get("paging", {}).get("total", "?")
                logger.info(f"  API-Football /{endpoint}: {remaining} results (requests: {self._daily_requests}/{self._daily_limit})")
                return data
        except Exception as e:
            logger.error(f"API-Football error: {e}")
            return None

    # ─── Standings (리그 순위) ───
    async def fetch_standings(self, league_key: str) -> List[TeamStats]:
        """리그 순위표 조회"""
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return []

        data = await self._get("standings", {"league": league_id, "season": CURRENT_SEASON})
        if not data:
            return []

        items = []
        try:
            standings = data["response"][0]["league"]["standings"][0]
            for entry in standings:
                team = entry.get("team", {})
                all_stats = entry.get("all", {})
                home_stats = entry.get("home", {})
                away_stats = entry.get("away", {})

                items.append(TeamStats(
                    team_name=team.get("name", ""),
                    league=league_key,
                    season=str(CURRENT_SEASON),
                    rank=entry.get("rank", 0),
                    played=all_stats.get("played", 0),
                    wins=all_stats.get("win", 0),
                    draws=all_stats.get("draw", 0),
                    losses=all_stats.get("lose", 0),
                    goals_for=all_stats.get("goals", {}).get("for", 0),
                    goals_against=all_stats.get("goals", {}).get("against", 0),
                    goal_diff=entry.get("goalsDiff", 0),
                    points=entry.get("points", 0),
                    form=entry.get("form", ""),
                    home_wins=home_stats.get("win", 0),
                    home_draws=home_stats.get("draw", 0),
                    home_losses=home_stats.get("lose", 0),
                    away_wins=away_stats.get("win", 0),
                    away_draws=away_stats.get("draw", 0),
                    away_losses=away_stats.get("lose", 0),
                ))
        except (KeyError, IndexError) as e:
            logger.error(f"Parse standings error: {e}")

        return items

    # ─── Head-to-Head (상대전적) ───
    async def fetch_h2h(self, team_a_id: int, team_b_id: int, last: int = 10) -> Optional[H2HRecord]:
        """상대전적 조회"""
        data = await self._get("fixtures/headtohead", {
            "h2h": f"{team_a_id}-{team_b_id}",
            "last": last,
        })
        if not data:
            return None

        try:
            fixtures = data.get("response", [])
            a_wins = 0
            b_wins = 0
            draws = 0
            recent = []

            for fix in fixtures:
                teams = fix.get("teams", {})
                goals = fix.get("goals", {})
                home_name = teams.get("home", {}).get("name", "")
                away_name = teams.get("away", {}).get("name", "")
                home_goals = goals.get("home", 0) or 0
                away_goals = goals.get("away", 0) or 0

                if home_goals > away_goals:
                    if teams.get("home", {}).get("id") == team_a_id:
                        a_wins += 1
                    else:
                        b_wins += 1
                elif home_goals < away_goals:
                    if teams.get("away", {}).get("id") == team_a_id:
                        a_wins += 1
                    else:
                        b_wins += 1
                else:
                    draws += 1

                recent.append({
                    "date": fix.get("fixture", {}).get("date", ""),
                    "home": home_name,
                    "away": away_name,
                    "score": f"{home_goals}-{away_goals}",
                })

            return H2HRecord(
                team_a=str(team_a_id),
                team_b=str(team_b_id),
                total_matches=len(fixtures),
                team_a_wins=a_wins,
                team_b_wins=b_wins,
                draws=draws,
                recent_results=recent[-5:],  # last 5
            )
        except Exception as e:
            logger.error(f"Parse H2H error: {e}")
            return None

    # ─── Injuries (부상/결장) ───
    async def fetch_injuries(self, league_key: str) -> List[InjuryInfo]:
        """현재 부상/결장 선수 조회"""
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return []

        data = await self._get("injuries", {
            "league": league_id,
            "season": CURRENT_SEASON,
        })
        if not data:
            return []

        items = []
        try:
            for entry in data.get("response", []):
                team = entry.get("team", {})
                player = entry.get("player", {})
                items.append(InjuryInfo(
                    team_name=team.get("name", ""),
                    player_name=player.get("name", ""),
                    reason=player.get("reason", ""),
                    status=player.get("type", ""),
                ))
        except Exception as e:
            logger.error(f"Parse injuries error: {e}")

        return items

    # ─── Predictions (API-Football AI) ───
    async def fetch_prediction(self, fixture_id: int) -> Optional[Dict]:
        """API-Football 내장 AI 예측 조회"""
        data = await self._get("predictions", {"fixture": fixture_id})
        if not data:
            return None

        try:
            pred = data["response"][0]
            predictions = pred.get("predictions", {})
            teams = pred.get("teams", {})

            return {
                "winner": predictions.get("winner", {}).get("name", ""),
                "win_or_draw": predictions.get("win_or_draw", False),
                "under_over": predictions.get("under_over", ""),
                "advice": predictions.get("advice", ""),
                "percent": predictions.get("percent", {}),
                "home_team": teams.get("home", {}).get("name", ""),
                "away_team": teams.get("away", {}).get("name", ""),
                "comparison": pred.get("comparison", {}),
            }
        except (KeyError, IndexError) as e:
            logger.error(f"Parse prediction error: {e}")
            return None

    # ─── Upcoming Fixtures (예정 경기 조회) ───
    async def fetch_upcoming_fixtures(self, league_key: str, next_count: int = 10) -> List[Dict]:
        """다가오는 경기 fixture IDs 조회"""
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return []

        data = await self._get("fixtures", {
            "league": league_id,
            "season": CURRENT_SEASON,
            "next": next_count,
        })
        if not data:
            return []

        fixtures = []
        for fix in data.get("response", []):
            fixture_data = fix.get("fixture", {})
            teams = fix.get("teams", {})
            fixtures.append({
                "fixture_id": fixture_data.get("id"),
                "date": fixture_data.get("date", ""),
                "home": teams.get("home", {}).get("name", ""),
                "away": teams.get("away", {}).get("name", ""),
                "home_id": teams.get("home", {}).get("id"),
                "away_id": teams.get("away", {}).get("id"),
            })
        return fixtures

    # ─── Lineups (라인업) ───
    async def fetch_lineups(self, fixture_id: int) -> Optional[Dict]:
        """경기 라인업 조회 (경기 시작 ~1시간 전부터 제공)"""
        data = await self._get("fixtures/lineups", {"fixture": fixture_id})
        if not data:
            return None

        try:
            response = data.get("response", [])
            if not response:
                return None

            lineups = {}
            for team_lineup in response:
                team = team_lineup.get("team", {})
                team_name = team.get("name", "")
                formation = team_lineup.get("formation", "")

                starters = []
                for player in team_lineup.get("startXI", []):
                    p = player.get("player", {})
                    starters.append({
                        "name": p.get("name", ""),
                        "number": p.get("number", 0),
                        "pos": p.get("pos", ""),
                    })

                subs = []
                for player in team_lineup.get("substitutes", []):
                    p = player.get("player", {})
                    subs.append({
                        "name": p.get("name", ""),
                        "number": p.get("number", 0),
                        "pos": p.get("pos", ""),
                    })

                coach_data = team_lineup.get("coach", {})
                lineups[team_name] = {
                    "formation": formation,
                    "starters": starters,
                    "substitutes": subs,
                    "coach": coach_data.get("name", ""),
                }

            return lineups
        except Exception as e:
            logger.error(f"Parse lineups error: {e}")
            return None

    # ─── Team Recent Fixtures (팀 최근 경기) ───
    async def fetch_team_last_matches(self, team_id: int, last_count: int = 5) -> List[Dict]:
        """특정 팀의 최근 경기 결과"""
        data = await self._get("fixtures", {
            "team": team_id,
            "last": last_count,
        })
        if not data:
            return []

        matches = []
        for fix in data.get("response", []):
            fixture_data = fix.get("fixture", {})
            teams = fix.get("teams", {})
            goals = fix.get("goals", {})
            league_info = fix.get("league", {})
            matches.append({
                "date": fixture_data.get("date", ""),
                "home": teams.get("home", {}).get("name", ""),
                "away": teams.get("away", {}).get("name", ""),
                "home_goals": goals.get("home", 0) or 0,
                "away_goals": goals.get("away", 0) or 0,
                "league": league_info.get("name", ""),
                "home_winner": teams.get("home", {}).get("winner"),
                "away_winner": teams.get("away", {}).get("winner"),
            })
        return matches

    # ─── Find Fixture ID by Team Names ───
    async def find_fixture_id(self, league_key: str, home_name: str, away_name: str) -> Optional[int]:
        """팀 이름으로 fixture ID 찾기"""
        fixtures = await self.fetch_upcoming_fixtures(league_key, next_count=20)
        for fix in fixtures:
            if (home_name.lower() in fix["home"].lower() or fix["home"].lower() in home_name.lower()) and \
               (away_name.lower() in fix["away"].lower() or fix["away"].lower() in away_name.lower()):
                return fix["fixture_id"]
        return None

    # ─── Find Team ID by Name ───
    async def search_team_id(self, team_name: str) -> Optional[int]:
        """팀 이름으로 ID 검색"""
        data = await self._get("teams", {"search": team_name})
        if not data:
            return None
        teams = data.get("response", [])
        if teams:
            return teams[0].get("team", {}).get("id")
        return None

    # ─── Batch Collection (일괄 수집) ───
    async def collect_all(self) -> Dict:
        """하루 1회 전체 데이터 수집 (100건 한도 최적화)"""
        if not self.api_key:
            logger.info("⏭️ API-Football skipped (no key)")
            return {"standings": {}, "injuries": {}, "predictions": []}

        result = {"standings": {}, "injuries": {}, "predictions": []}
        self._daily_requests = 0  # Reset daily counter

        # 1. Standings for top leagues (6 requests)
        for league_key in LEAGUE_MAP:
            standings = await self.fetch_standings(league_key)
            if standings:
                result["standings"][league_key] = [s.model_dump() for s in standings]
            logger.info(f"  📊 {league_key}: {len(standings)} teams")

        # 2. Injuries for top leagues (6 requests)
        for league_key in LEAGUE_MAP:
            injuries = await self.fetch_injuries(league_key)
            if injuries:
                result["injuries"][league_key] = [i.model_dump() for i in injuries]
            logger.info(f"  🏥 {league_key}: {len(injuries)} injuries")

        # 3. Upcoming fixtures + predictions (save remaining quota)
        #    ~6 leagues × 5 fixtures × 1 prediction = ~36 requests
        remaining = self._daily_limit - self._daily_requests
        predictions_budget = max(0, remaining - 10)  # Keep 10 buffer
        pred_count = 0

        for league_key in LEAGUE_MAP:
            if pred_count >= predictions_budget:
                break
            fixtures = await self.fetch_upcoming_fixtures(league_key, next_count=5)
            for fix in fixtures:
                if pred_count >= predictions_budget:
                    break
                pred = await self.fetch_prediction(fix["fixture_id"])
                if pred:
                    pred["league"] = league_key
                    pred["fixture_id"] = fix["fixture_id"]
                    pred["date"] = fix["date"]
                    result["predictions"].append(pred)
                    pred_count += 1

        self._last_fetch = datetime.now(timezone.utc).isoformat()
        self._cache = result
        logger.info(f"✅ API-Football collection complete: {self._daily_requests} requests used")
        return result

    # ─── Live Scores (실시간 스코어) ───
    _live_cache: Dict = {}
    _live_cache_time: Optional[datetime] = None
    _live_cache_ttl: int = 60  # 60초 캐시

    async def fetch_live_scores(self, league_key: Optional[str] = None) -> List[Dict]:
        """현재 실시간 진행 중인 경기 스코어 조회
        - 60초 캐시 적용 (API quota 절약)
        - 1 request로 모든 라이브 경기 조회
        """
        now = datetime.now(timezone.utc)

        # 캐시 유효성 검사
        if (self._live_cache_time and
            (now - self._live_cache_time).total_seconds() < self._live_cache_ttl and
            self._live_cache.get("matches")):
            matches = self._live_cache["matches"]
            if league_key:
                league_id = LEAGUE_MAP.get(league_key)
                matches = [m for m in matches if m.get("league_id") == league_id]
            return matches

        # API 조회 (live=all은 1 request로 모든 진행중 경기 반환)
        data = await self._get("fixtures", {"live": "all"})
        if not data:
            return self._live_cache.get("matches", [])

        matches = []
        try:
            for fix in data.get("response", []):
                fixture = fix.get("fixture", {})
                teams = fix.get("teams", {})
                goals = fix.get("goals", {})
                score = fix.get("score", {})
                league = fix.get("league", {})
                events = fix.get("events", [])

                # 주요 이벤트 추출 (골, 레드카드)
                key_events = []
                for ev in events[-10:]:  # 최근 10개 이벤트만
                    ev_type = ev.get("type", "")
                    if ev_type in ("Goal", "Card"):
                        detail = ev.get("detail", "")
                        if ev_type == "Card" and detail != "Red Card":
                            continue
                        key_events.append({
                            "time": ev.get("time", {}).get("elapsed", 0),
                            "type": ev_type,
                            "detail": detail,
                            "player": ev.get("player", {}).get("name", ""),
                            "team": ev.get("team", {}).get("name", ""),
                        })

                match_info = {
                    "fixture_id": fixture.get("id"),
                    "status": fixture.get("status", {}).get("short", ""),  # 1H, 2H, HT, FT, etc
                    "status_long": fixture.get("status", {}).get("long", ""),
                    "elapsed": fixture.get("status", {}).get("elapsed", 0),  # 경과 시간 (분)
                    "home": teams.get("home", {}).get("name", ""),
                    "away": teams.get("away", {}).get("name", ""),
                    "home_id": teams.get("home", {}).get("id"),
                    "away_id": teams.get("away", {}).get("id"),
                    "home_logo": teams.get("home", {}).get("logo", ""),
                    "away_logo": teams.get("away", {}).get("logo", ""),
                    "home_goals": goals.get("home", 0) or 0,
                    "away_goals": goals.get("away", 0) or 0,
                    "halftime": {
                        "home": score.get("halftime", {}).get("home", 0) or 0,
                        "away": score.get("halftime", {}).get("away", 0) or 0,
                    },
                    "league_id": league.get("id"),
                    "league_name": league.get("name", ""),
                    "league_country": league.get("country", ""),
                    "league_logo": league.get("logo", ""),
                    "events": key_events,
                }
                matches.append(match_info)
        except Exception as e:
            logger.error(f"Parse live scores error: {e}")

        # 캐시 갱신
        self._live_cache = {"matches": matches, "updated_at": now.isoformat()}
        self._live_cache_time = now
        logger.info(f"⚽ Live scores: {len(matches)} matches in progress")

        if league_key:
            league_id = LEAGUE_MAP.get(league_key)
            return [m for m in matches if m.get("league_id") == league_id]
        return matches

    def get_live_cache(self) -> Dict:
        """캐시된 라이브 스코어 반환"""
        return self._live_cache

    def get_cached(self) -> Dict:
        """캐시된 데이터 반환"""
        return self._cache
