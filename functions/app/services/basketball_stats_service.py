"""
API-Basketball 연동 서비스
- NBA / 유로리그 통계
- 무료 100건/일
- Docs: https://api-basketball.com/documentation
"""
import httpx
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime, timezone
from app.schemas.predictions import TeamStats

logger = logging.getLogger(__name__)

# API-Basketball league IDs
LEAGUE_MAP = {
    "basketball_nba": 12,        # NBA
    "basketball_euroleague": 120,  # EuroLeague
}

CURRENT_SEASON = "2025-2026"


class BasketballStatsService:
    def __init__(self):
        self.api_key = os.getenv("API_BASKETBALL_KEY", "")
        self.base_url = "https://v1.basketball.api-sports.io"
        self._daily_requests = 0
        self._daily_limit = 100
        self._cache: Dict[str, any] = {}
        self._last_fetch: Optional[str] = None

        if self.api_key:
            logger.info("✅ API-Basketball key loaded")
        else:
            logger.warning("⚠️ No API_BASKETBALL_KEY — basketball stats unavailable")

    def _headers(self) -> Dict:
        return {
            "x-apisports-key": self.api_key,
        }

    def _can_request(self) -> bool:
        if not self.api_key:
            return False
        if self._daily_requests >= self._daily_limit:
            logger.warning(f"⚠️ API-Basketball daily limit reached")
            return False
        return True

    async def _get(self, endpoint: str, params: Dict) -> Optional[Dict]:
        if not self._can_request():
            return None
        url = f"{self.base_url}/{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
                self._daily_requests += 1
                if resp.status_code != 200:
                    logger.warning(f"API-Basketball {endpoint}: HTTP {resp.status_code}")
                    return None
                data = resp.json()
                if data.get("errors"):
                    logger.warning(f"API-Basketball errors: {data['errors']}")
                    return None
                return data
        except Exception as e:
            logger.error(f"API-Basketball error: {e}")
            return None

    # ─── Standings ───
    async def fetch_standings(self, league_key: str) -> List[TeamStats]:
        """리그 순위표"""
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return []

        data = await self._get("standings", {
            "league": league_id,
            "season": CURRENT_SEASON,
        })
        if not data:
            return []

        items = []
        try:
            for group in data.get("response", []):
                for entry in group if isinstance(group, list) else [group]:
                    team = entry.get("team", {})
                    games = entry.get("games", {})
                    win_data = entry.get("win", {})
                    loss_data = entry.get("loss", {})

                    wins_total = win_data.get("total", 0) if isinstance(win_data, dict) else 0
                    losses_total = loss_data.get("total", 0) if isinstance(loss_data, dict) else 0
                    wins_home = win_data.get("home", 0) if isinstance(win_data, dict) else 0
                    losses_home = loss_data.get("home", 0) if isinstance(loss_data, dict) else 0
                    wins_away = win_data.get("away", 0) if isinstance(win_data, dict) else 0
                    losses_away = loss_data.get("away", 0) if isinstance(loss_data, dict) else 0

                    played = games.get("played", 0) if isinstance(games, dict) else 0

                    items.append(TeamStats(
                        team_name=team.get("name", ""),
                        league=league_key,
                        season=CURRENT_SEASON,
                        rank=entry.get("position", 0),
                        played=played,
                        wins=wins_total,
                        draws=0,  # Basketball has no draws
                        losses=losses_total,
                        goals_for=0,
                        goals_against=0,
                        goal_diff=0,
                        points=entry.get("points", {}).get("for", 0) if isinstance(entry.get("points"), dict) else 0,
                        form=entry.get("form", "") or "",
                        home_wins=wins_home,
                        home_draws=0,
                        home_losses=losses_home,
                        away_wins=wins_away,
                        away_draws=0,
                        away_losses=losses_away,
                    ))
        except Exception as e:
            logger.error(f"Parse basketball standings error: {e}")

        return items

    # ─── Team Statistics ───
    async def fetch_team_stats(self, team_id: int, league_key: str) -> Optional[Dict]:
        """팀 시즌 전체 통계"""
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return None

        data = await self._get("statistics", {
            "team": team_id,
            "league": league_id,
            "season": CURRENT_SEASON,
        })
        if not data:
            return None

        try:
            resp = data["response"]
            games = resp.get("games", {})
            points = resp.get("points", {})
            return {
                "team": resp.get("team", {}).get("name", ""),
                "games_played": games.get("played", {}).get("all", 0),
                "wins": games.get("wins", {}).get("all", {}).get("total", 0),
                "losses": games.get("loses", {}).get("all", {}).get("total", 0),
                "points_for_avg": points.get("for", {}).get("average", {}).get("all", "0"),
                "points_against_avg": points.get("against", {}).get("average", {}).get("all", "0"),
            }
        except Exception as e:
            logger.error(f"Parse team stats error: {e}")
            return None

    # ─── Batch Collection ───
    async def collect_all(self) -> Dict:
        """전체 데이터 수집"""
        if not self.api_key:
            logger.info("⏭️ API-Basketball skipped (no key)")
            return {}

        result = {}
        self._daily_requests = 0

        for league_key in LEAGUE_MAP:
            standings = await self.fetch_standings(league_key)
            if standings:
                result[league_key] = [s.model_dump() for s in standings]
                logger.info(f"  🏀 {league_key}: {len(standings)} teams")

        self._cache = result
        self._last_fetch = datetime.now(timezone.utc).isoformat()
        logger.info(f"✅ API-Basketball collection complete: {self._daily_requests} requests used")
        return result

    def get_cached(self) -> Dict:
        return self._cache
