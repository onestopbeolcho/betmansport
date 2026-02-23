"""
football-data.org 연동 서비스
- 리그 순위, 경기 결과, 득점자
- 완전 무료 (12개 대회, 10건/분)
- Docs: https://www.football-data.org/documentation/api
"""
import httpx
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime, timezone
from app.schemas.predictions import TeamStats

logger = logging.getLogger(__name__)

# football-data.org competition IDs
COMPETITION_MAP = {
    "soccer_epl": "PL",         # Premier League
    "soccer_spain_la_liga": "PD",  # Primera Division
    "soccer_germany_bundesliga": "BL1",  # Bundesliga
    "soccer_italy_serie_a": "SA",  # Serie A
    "soccer_france_ligue_one": "FL1",  # Ligue 1
    "soccer_uefa_champs_league": "CL",  # Champions League
}


class LeagueStandingsService:
    def __init__(self):
        self.api_key = os.getenv("FOOTBALL_DATA_API_KEY", "")
        self.base_url = "https://api.football-data.org/v4"
        self._cache: Dict[str, List[TeamStats]] = {}
        self._last_fetch: Optional[str] = None

        if self.api_key:
            logger.info("✅ football-data.org key loaded")
        else:
            logger.warning("⚠️ No FOOTBALL_DATA_API_KEY — league standings unavailable")

    def _headers(self) -> Dict:
        return {"X-Auth-Token": self.api_key}

    async def _get(self, endpoint: str) -> Optional[Dict]:
        if not self.api_key:
            return None
        url = f"{self.base_url}/{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=self._headers())
                if resp.status_code == 429:
                    logger.warning("⚠️ football-data.org rate limited (10/min)")
                    return None
                if resp.status_code != 200:
                    logger.warning(f"football-data.org {endpoint}: HTTP {resp.status_code}")
                    return None
                return resp.json()
        except Exception as e:
            logger.error(f"football-data.org error: {e}")
            return None

    # ─── Standings ───
    async def fetch_standings(self, league_key: str) -> List[TeamStats]:
        """리그 순위표 조회"""
        comp_code = COMPETITION_MAP.get(league_key)
        if not comp_code:
            return []

        data = await self._get(f"competitions/{comp_code}/standings")
        if not data:
            return []

        items = []
        try:
            standings = data.get("standings", [])
            # Use TOTAL standings (not home/away split)
            total_table = next((s for s in standings if s.get("type") == "TOTAL"), None)
            if not total_table:
                return []

            # Also get home/away tables
            home_table = next((s for s in standings if s.get("type") == "HOME"), {})
            away_table = next((s for s in standings if s.get("type") == "AWAY"), {})

            home_map = {e["team"]["id"]: e for e in home_table.get("table", [])}
            away_map = {e["team"]["id"]: e for e in away_table.get("table", [])}

            for entry in total_table.get("table", []):
                team = entry.get("team", {})
                team_id = team.get("id")

                home_entry = home_map.get(team_id, {})
                away_entry = away_map.get(team_id, {})

                items.append(TeamStats(
                    team_name=team.get("name", ""),
                    league=league_key,
                    season=data.get("season", {}).get("startDate", "")[:4],
                    rank=entry.get("position", 0),
                    played=entry.get("playedGames", 0),
                    wins=entry.get("won", 0),
                    draws=entry.get("draw", 0),
                    losses=entry.get("lost", 0),
                    goals_for=entry.get("goalsFor", 0),
                    goals_against=entry.get("goalsAgainst", 0),
                    goal_diff=entry.get("goalDifference", 0),
                    points=entry.get("points", 0),
                    form=entry.get("form", "") or "",
                    home_wins=home_entry.get("won", 0),
                    home_draws=home_entry.get("draw", 0),
                    home_losses=home_entry.get("lost", 0),
                    away_wins=away_entry.get("won", 0),
                    away_draws=away_entry.get("draw", 0),
                    away_losses=away_entry.get("lost", 0),
                ))
        except Exception as e:
            logger.error(f"Parse standings error: {e}")

        return items

    # ─── Top Scorers ───
    async def fetch_scorers(self, league_key: str, limit: int = 10) -> List[Dict]:
        """리그 득점 순위"""
        comp_code = COMPETITION_MAP.get(league_key)
        if not comp_code:
            return []

        data = await self._get(f"competitions/{comp_code}/scorers?limit={limit}")
        if not data:
            return []

        scorers = []
        try:
            for entry in data.get("scorers", []):
                player = entry.get("player", {})
                team = entry.get("team", {})
                scorers.append({
                    "player": player.get("name", ""),
                    "team": team.get("name", ""),
                    "goals": entry.get("goals", 0),
                    "assists": entry.get("assists", 0),
                    "played": entry.get("playedMatches", 0),
                })
        except Exception as e:
            logger.error(f"Parse scorers error: {e}")

        return scorers

    # ─── Recent Matches (최근 경기 결과) ───
    async def fetch_recent_matches(self, league_key: str, limit: int = 10) -> List[Dict]:
        """최근 완료된 경기 결과"""
        comp_code = COMPETITION_MAP.get(league_key)
        if not comp_code:
            return []

        data = await self._get(f"competitions/{comp_code}/matches?status=FINISHED&limit={limit}")
        if not data:
            return []

        matches = []
        try:
            for m in data.get("matches", [])[-limit:]:
                home = m.get("homeTeam", {})
                away = m.get("awayTeam", {})
                score = m.get("score", {}).get("fullTime", {})
                matches.append({
                    "date": m.get("utcDate", ""),
                    "home": home.get("name", ""),
                    "away": away.get("name", ""),
                    "home_goals": score.get("home", 0),
                    "away_goals": score.get("away", 0),
                })
        except Exception as e:
            logger.error(f"Parse matches error: {e}")

        return matches

    # ─── Batch Collection ───
    async def collect_all(self) -> Dict:
        """전체 리그 순위 수집 (완전 무료)"""
        if not self.api_key:
            logger.info("⏭️ football-data.org skipped (no key)")
            return {}

        result = {}
        for league_key in COMPETITION_MAP:
            standings = await self.fetch_standings(league_key)
            if standings:
                result[league_key] = [s.model_dump() for s in standings]
                logger.info(f"  📊 {league_key}: {len(standings)} teams")

        self._cache = {k: [TeamStats(**s) for s in v] for k, v in result.items()}
        self._last_fetch = datetime.now(timezone.utc).isoformat()
        logger.info(f"✅ football-data.org collection complete: {len(result)} leagues")
        return result

    def get_team_rank(self, league_key: str, team_name: str) -> int:
        """팀 순위 조회 (캐시)"""
        standings = self._cache.get(league_key, [])
        for team in standings:
            if team.team_name.lower() == team_name.lower():
                return team.rank
        return 0

    def get_team_form(self, league_key: str, team_name: str) -> str:
        """팀 최근 폼 조회 (캐시)"""
        standings = self._cache.get(league_key, [])
        for team in standings:
            if team.team_name.lower() == team_name.lower():
                return team.form
        return ""

    def get_cached(self) -> Dict:
        return {k: [s.model_dump() for s in v] for k, v in self._cache.items()}
