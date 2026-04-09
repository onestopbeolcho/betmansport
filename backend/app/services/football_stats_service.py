"""
API-Football 연동 서비스 (Ultra Plan)
- 배당 수집, 팀 통계, H2H 상대전적, 부상/결장, AI Predictions, 라이브
- Ultra 75,000건/일 — The Odds API 통합 대체
- Docs: https://www.api-football.com/documentation-v3
"""
import httpx
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
from app.schemas.predictions import TeamStats, H2HRecord, InjuryInfo

logger = logging.getLogger(__name__)

# API-Football league IDs — 각국 1부 리그 + 주요 대회
LEAGUE_MAP = {
    # ─── 유럽 빅 5 ───
    "soccer_epl": 39,                       # 🏴 England — Premier League
    "soccer_spain_la_liga": 140,            # 🇪🇸 Spain — La Liga
    "soccer_germany_bundesliga": 78,        # 🇩🇪 Germany — Bundesliga
    "soccer_italy_serie_a": 135,            # 🇮🇹 Italy — Serie A
    "soccer_france_ligue_one": 61,          # 🇫🇷 France — Ligue 1
    # ─── 유럽 기타 1부 ───
    "soccer_netherlands_eredivisie": 88,    # 🇳🇱 Netherlands — Eredivisie
    "soccer_portugal_liga": 94,             # 🇵🇹 Portugal — Liga Portugal
    "soccer_belgium_pro_league": 144,       # 🇧🇪 Belgium — Pro League
    "soccer_turkey_super_lig": 203,         # 🇹🇷 Turkey — Süper Lig
    "soccer_scotland_premiership": 179,     # 🏴 Scotland — Premiership
    "soccer_switzerland_super_league": 207, # 🇨🇭 Switzerland — Super League
    "soccer_austria_bundesliga": 218,       # 🇦🇹 Austria — Bundesliga
    "soccer_denmark_superliga": 119,        # 🇩🇰 Denmark — Superliga
    "soccer_norway_eliteserien": 103,       # 🇳🇴 Norway — Eliteserien
    "soccer_sweden_allsvenskan": 113,       # 🇸🇪 Sweden — Allsvenskan
    "soccer_greece_super_league": 197,      # 🇬🇷 Greece — Super League
    "soccer_czech_first_league": 345,       # 🇨🇿 Czech — First League
    "soccer_poland_ekstraklasa": 106,       # 🇵🇱 Poland — Ekstraklasa
    "soccer_croatia_hnl": 210,              # 🇭🇷 Croatia — HNL
    "soccer_serbia_superliga": 286,         # 🇷🇸 Serbia — SuperLiga
    # ─── 대회 ───
    "soccer_uefa_champs_league": 2,         # 🇪🇺 Champions League
    "soccer_uefa_europa_league": 3,         # 🇪🇺 Europa League
    "soccer_uefa_europa_conference_league": 848, # 🇪🇺 Europa Conference League
    # ─── 아시아 ───
    "soccer_korea_kleague": 292,            # 🇰🇷 Korea — K League 1
    "soccer_japan_jleague": 98,             # 🇯🇵 Japan — J1 League
    "soccer_china_super_league": 169,       # 🇨🇳 China — Super League
    "soccer_australia_aleague": 188,        # 🇦🇺 Australia — A-League
    "soccer_saudi_pro_league": 307,         # 🇸🇦 Saudi Arabia — Pro League
    "soccer_india_super_league": 323,       # 🇮🇳 India — Super League
    # ─── 아메리카 ───
    "soccer_usa_mls": 253,                  # 🇺🇸 USA — MLS
    "soccer_brazil_serie_a": 71,            # 🇧🇷 Brazil — Brasileirão Série A
    "soccer_mexico_liga_mx": 262,           # 🇲🇽 Mexico — Liga MX
    "soccer_argentina_liga": 128,           # 🇦🇷 Argentina — Liga Profesional
    # ─── 아프리카 ───
    "soccer_egypt_premier_league": 233,     # 🇪🇬 Egypt — Premier League
}

CURRENT_SEASON = 2025  # 2025-2026 시즌

# Pinnacle bookmaker ID in API-Football = 4
PINNACLE_BOOKMAKER_ID = 4
# Bet365 bookmaker ID = 6 (fallback)
BET365_BOOKMAKER_ID = 6



class FootballStatsService:
    def __init__(self):
        self.api_key = os.getenv("API_FOOTBALL_KEY", "")
        self.base_url = "https://v3.football.api-sports.io"
        self._daily_requests = 0
        self._daily_limit = 75000  # Ultra plan
        self._cache: Dict[str, any] = {}
        self._last_fetch: Optional[str] = None
        # team_name → team_id 매핑 캐시 (standings에서 수집)
        self._team_id_map: Dict[str, int] = {}
        # H2H 캐시: "teamA_vs_teamB" → H2HRecord
        self._h2h_cache: Dict[str, dict] = {}

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

                team_name = team.get("name", "")
                team_id = team.get("id")
                # team_name → team_id 맵핑 저장
                if team_name and team_id:
                    self._team_id_map[team_name.lower()] = team_id

                items.append(TeamStats(
                    team_name=team_name,
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
    def find_team_id(self, team_name: str) -> Optional[int]:
        """캐시된 team_id_map에서 팀 ID 검색 (API 호출 없음)"""
        name_lower = team_name.lower()
        # 정확한 매칭
        if name_lower in self._team_id_map:
            return self._team_id_map[name_lower]
        # 부분 매칭
        for cached_name, team_id in self._team_id_map.items():
            if name_lower in cached_name or cached_name in name_lower:
                return team_id
        return None

    def get_h2h_cache(self) -> Dict[str, dict]:
        """캐시된 H2H 상대전적 반환"""
        return self._h2h_cache

    async def collect_all(self) -> Dict:
        """하루 1회 전체 데이터 수집 (100건 한도 최적화)"""
        if not self.api_key:
            logger.info("⏭️ API-Football skipped (no key)")
            return {"standings": {}, "injuries": {}, "predictions": [], "h2h": {}}

        result = {"standings": {}, "injuries": {}, "predictions": [], "h2h": {}}
        self._daily_requests = 0  # Reset daily counter

        # 1. Standings for top leagues (6 requests)
        #    → team_id_map도 자동으로 채워짐
        for league_key in LEAGUE_MAP:
            standings = await self.fetch_standings(league_key)
            if standings:
                result["standings"][league_key] = [s.model_dump() for s in standings]
            logger.info(f"  📊 {league_key}: {len(standings)} teams")
        logger.info(f"  🗂️ Team ID map: {len(self._team_id_map)} teams cached")

        # 2. Injuries for top leagues (6 requests)
        for league_key in LEAGUE_MAP:
            injuries = await self.fetch_injuries(league_key)
            if injuries:
                result["injuries"][league_key] = [i.model_dump() for i in injuries]
            logger.info(f"  🏥 {league_key}: {len(injuries)} injuries")

        # 3. Upcoming fixtures + predictions + H2H
        remaining = self._daily_limit - self._daily_requests
        # H2H 예산: 최대 50건 (42개 리그 대응)
        h2h_budget = min(50, max(0, remaining - 100))
        predictions_budget = max(0, remaining - h2h_budget - 50)
        pred_count = 0
        h2h_count = 0
        h2h_seen = set()  # 중복 방지

        for league_key in LEAGUE_MAP:
            if pred_count >= predictions_budget and h2h_count >= h2h_budget:
                break
            fixtures = await self.fetch_upcoming_fixtures(league_key, next_count=8)
            for fix in fixtures:
                # Predictions
                if pred_count < predictions_budget:
                    pred = await self.fetch_prediction(fix["fixture_id"])
                    if pred:
                        pred["league"] = league_key
                        pred["fixture_id"] = fix["fixture_id"]
                        pred["date"] = fix["date"]
                        result["predictions"].append(pred)
                        pred_count += 1

                # H2H (home_id/away_id가 fixture에서 이미 제공됨)
                home_id = fix.get("home_id")
                away_id = fix.get("away_id")
                h2h_key = f"{fix['home']}_vs_{fix['away']}"
                if (h2h_count < h2h_budget and
                    home_id and away_id and
                    h2h_key not in h2h_seen):
                    h2h_record = await self.fetch_h2h(home_id, away_id, last=10)
                    if h2h_record:
                        # 팀 이름으로도 접근 가능하도록 저장
                        h2h_data = h2h_record.model_dump()
                        h2h_data["home_team"] = fix["home"]
                        h2h_data["away_team"] = fix["away"]
                        self._h2h_cache[h2h_key] = h2h_data
                        result["h2h"][h2h_key] = h2h_data
                        h2h_count += 1
                    h2h_seen.add(h2h_key)

        logger.info(f"  🤝 H2H: {h2h_count} matchups collected")
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

    # ─── Odds (배당 수집 — The Odds API 대체) ───
    _odds_cache: List = []
    _odds_cache_time: Optional[datetime] = None
    _odds_cache_ttl: int = 300  # 5분 캐시

    async def fetch_odds_for_league(self, league_id: int, season: int = CURRENT_SEASON) -> List[Dict]:
        """
        특정 리그의 다가오는 경기 배당을 API-Football /odds 엔드포인트에서 수집.
        bookmaker: Pinnacle(4) 우선, 없으면 bet365(6) fallback.
        """
        data = await self._get("odds", {
            "league": league_id,
            "season": season,
            "bookmaker": PINNACLE_BOOKMAKER_ID,
        })
        if not data or not data.get("response"):
            # Pinnacle 없으면 bet365 시도
            data = await self._get("odds", {
                "league": league_id,
                "season": season,
                "bookmaker": BET365_BOOKMAKER_ID,
            })
        if not data:
            return []

        results = []
        for item in data.get("response", []):
            fixture = item.get("fixture", {})
            fixture_id = fixture.get("id")
            fixture_date = fixture.get("date", "")
            league_info = item.get("league", {})

            for bookie in item.get("bookmakers", []):
                bookie_name = bookie.get("name", "")
                for bet in bookie.get("bets", []):
                    # "Match Winner" = h2h (1X2)
                    if bet.get("name") != "Match Winner":
                        continue
                    home_odds = 0.0
                    draw_odds = 0.0
                    away_odds = 0.0
                    for val in bet.get("values", []):
                        v = val.get("value", "")
                        odd = float(val.get("odd", 0))
                        if v == "Home":
                            home_odds = odd
                        elif v == "Draw":
                            draw_odds = odd
                        elif v == "Away":
                            away_odds = odd

                    if home_odds > 0 and away_odds > 0:
                        results.append({
                            "fixture_id": fixture_id,
                            "home_odds": home_odds,
                            "draw_odds": draw_odds,
                            "away_odds": away_odds,
                            "bookmaker": bookie_name,
                            "match_time": fixture_date,
                            "league_name": league_info.get("name", ""),
                            "league_country": league_info.get("country", ""),
                        })
                    break  # 첫 번째 Match Winner만
                break  # 첫 번째 bookie만
        return results

    async def fetch_all_odds(self) -> List[Dict]:
        """
        전체 리그 배당 수집 — PinnacleService.refresh_odds() 대체.
        API-Football /odds 엔드포인트 + /fixtures로 팀 이름 매핑.
        """
        all_odds = []

        for league_key, league_id in LEAGUE_MAP.items():
            # 먼저 다가오는 경기 목록 조회 (팀 이름 확보)
            fixtures_data = await self._get("fixtures", {
                "league": league_id,
                "season": CURRENT_SEASON,
                "next": 15,
            })
            if not fixtures_data:
                continue

            # fixture_id → 팀 이름 매핑
            fixture_teams = {}
            for fix in fixtures_data.get("response", []):
                fid = fix.get("fixture", {}).get("id")
                home = fix.get("teams", {}).get("home", {})
                away = fix.get("teams", {}).get("away", {})
                fixture_teams[fid] = {
                    "home": home.get("name", ""),
                    "away": away.get("name", ""),
                    "date": fix.get("fixture", {}).get("date", ""),
                }

            # 배당 수집
            odds_list = await self.fetch_odds_for_league(league_id)
            for o in odds_list:
                fid = o.get("fixture_id")
                teams = fixture_teams.get(fid, {})
                if teams:
                    o["home_team"] = teams.get("home", "")
                    o["away_team"] = teams.get("away", "")
                    if not o.get("match_time"):
                        o["match_time"] = teams.get("date", "")
                    o["sport"] = "Soccer"
                    o["league"] = o.get("league_name", league_key)
                    all_odds.append(o)

            logger.info(f"  🎰 {league_key}: {len(odds_list)} odds")

        self._odds_cache = all_odds
        self._odds_cache_time = datetime.now(timezone.utc)
        logger.info(f"✅ Total odds collected: {len(all_odds)}")
        return all_odds

    def get_odds_cache(self) -> List[Dict]:
        """캐시된 배당 데이터 반환"""
        return self._odds_cache

    # ─── Finished Fixtures (경기 결과 — The Odds API scores 대체) ───

    async def fetch_finished_fixtures(self, days_back: int = 3) -> List[Dict]:
        """
        최근 N일간 완료된 경기 결과 조회 — ResultGrader 대체용.
        API-Football /fixtures?status=FT 사용.
        """
        date_from = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")
        date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        all_results = []
        for league_key, league_id in LEAGUE_MAP.items():
            data = await self._get("fixtures", {
                "league": league_id,
                "season": CURRENT_SEASON,
                "from": date_from,
                "to": date_to,
                "status": "FT-AET-PEN",  # Finished, After Extra Time, Penalties
            })
            if not data:
                continue

            for fix in data.get("response", []):
                fixture = fix.get("fixture", {})
                teams = fix.get("teams", {})
                goals = fix.get("goals", {})
                score = fix.get("score", {})
                league = fix.get("league", {})

                result = {
                    "fixture_id": fixture.get("id"),
                    "home_team": teams.get("home", {}).get("name", ""),
                    "away_team": teams.get("away", {}).get("name", ""),
                    "home_score": goals.get("home", 0) or 0,
                    "away_score": goals.get("away", 0) or 0,
                    "status": "Finished",
                    "sport": "soccer",
                    "sport_key": f"soccer_{league.get('country', '').lower()}",
                    "commence_time": fixture.get("date", ""),
                    "league_name": league.get("name", ""),
                    # 정규시간 스코어 (축구 배당 정산용)
                    "fulltime_home": score.get("fulltime", {}).get("home", 0) or 0,
                    "fulltime_away": score.get("fulltime", {}).get("away", 0) or 0,
                }
                all_results.append(result)

        logger.info(f"📊 Finished fixtures ({days_back}d): {len(all_results)} results")
        return all_results
