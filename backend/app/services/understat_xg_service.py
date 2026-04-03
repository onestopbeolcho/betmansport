"""
Understat xG 스크레이핑 서비스
- EPL, La Liga, Bundesliga, Serie A, Ligue 1, RFPL 지원
- 팀별 xG, xGA, npxG, npxGA, ppda, deep 통계
- 무료, API 키 불필요
- 데이터 소스: https://understat.com
- 시즌별 팀 통계 + 경기별 xG 수집

Phase 1: 이 파일만 추가 (기존 코드 수정 없음)
Phase 2: feature_store_v2.py에서 이 데이터를 ML 피처로 활용
"""
import httpx
import json
import re
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Understat 리그 매핑 (Understat URL slug → 내부 리그 키)
UNDERSTAT_LEAGUES = {
    "EPL": "soccer_epl",
    "La_liga": "soccer_spain_la_liga",
    "Bundesliga": "soccer_germany_bundesliga",
    "Serie_A": "soccer_italy_serie_a",
    "Ligue_1": "soccer_france_ligue_one",
    # RFPL (러시아) — 추후 확장 가능
}

CURRENT_SEASON = "2025"


class UnderstatXGService:
    """Understat.com에서 팀별 xG 데이터를 스크레이핑하는 서비스."""

    def __init__(self):
        self.base_url = "https://understat.com"
        self._cache: Dict[str, Dict] = {}  # league_key → {team → stats}
        self._match_cache: Dict[str, List] = {}  # league_key → [match xG data]
        self._last_fetch: Optional[str] = None
        self._headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _extract_json_var(self, html: str, var_name: str) -> Optional[str]:
        """HTML에서 JavaScript 변수의 JSON 데이터를 추출."""
        pattern = rf"var\s+{var_name}\s*=\s*JSON\.parse\('(.+?)'\)"
        match = re.search(pattern, html)
        if not match:
            return None
        # Understat encodes special chars
        encoded = match.group(1)
        decoded = encoded.encode().decode("unicode_escape")
        return decoded

    async def fetch_league_teams_xg(self, understat_league: str, season: str = CURRENT_SEASON) -> Dict[str, Dict]:
        """
        리그의 모든 팀 xG 통계를 가져옵니다.
        
        Returns:
            {
                "Manchester City": {
                    "xG": 45.2, "xGA": 18.5, "npxG": 40.1, "npxGA": 17.2,
                    "ppda": 8.5, "deep": 320, "scored": 48, "missed": 15,
                    "wins": 18, "draws": 3, "loses": 2, "pts": 57
                },
                ...
            }
        """
        url = f"{self.base_url}/league/{understat_league}/{season}"
        
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=self._headers)
                if resp.status_code != 200:
                    logger.warning(f"Understat {understat_league}: HTTP {resp.status_code}")
                    return {}

                html = resp.text
                teams_data_str = self._extract_json_var(html, "teamsData")
                if not teams_data_str:
                    logger.warning(f"Understat: teamsData not found for {understat_league}")
                    return {}

                teams_data = json.loads(teams_data_str)
                result = {}

                for team_id, team_info in teams_data.items():
                    team_name = team_info.get("title", "")
                    history = team_info.get("history", [])
                    
                    if not history:
                        continue

                    # 시즌 누적 통계 계산
                    total_xg = sum(float(m.get("xG", 0)) for m in history)
                    total_xga = sum(float(m.get("xGA", 0)) for m in history)
                    total_npxg = sum(float(m.get("npxG", 0)) for m in history)
                    total_npxga = sum(float(m.get("npxGA", 0)) for m in history)
                    total_ppda = sum(float(m.get("ppda", {}).get("att", 0)) / max(float(m.get("ppda", {}).get("def", 1)), 1) for m in history) / max(len(history), 1)
                    total_deep = sum(int(m.get("deep", 0)) for m in history)
                    total_scored = sum(int(m.get("scored", 0)) for m in history)
                    total_missed = sum(int(m.get("missed", 0)) for m in history)
                    total_wins = sum(1 for m in history if m.get("result") == "w")
                    total_draws = sum(1 for m in history if m.get("result") == "d")
                    total_loses = sum(1 for m in history if m.get("result") == "l")
                    total_pts = total_wins * 3 + total_draws
                    matches_played = len(history)

                    result[team_name] = {
                        "team_id": team_id,
                        "matches_played": matches_played,
                        "xG": round(total_xg, 2),
                        "xGA": round(total_xga, 2),
                        "npxG": round(total_npxg, 2),
                        "npxGA": round(total_npxga, 2),
                        "xG_per_match": round(total_xg / max(matches_played, 1), 3),
                        "xGA_per_match": round(total_xga / max(matches_played, 1), 3),
                        "xG_diff": round(total_xg - total_xga, 2),
                        "npxG_diff": round(total_npxg - total_npxga, 2),
                        "ppda_avg": round(total_ppda, 2),
                        "deep_completions": total_deep,
                        "scored": total_scored,
                        "missed": total_missed,
                        "xG_overperformance": round(total_scored - total_xg, 2),  # 실제 득점 - xG
                        "wins": total_wins,
                        "draws": total_draws,
                        "loses": total_loses,
                        "pts": total_pts,
                    }

                logger.info(f"✅ Understat {understat_league}: {len(result)} teams xG loaded")
                return result

        except Exception as e:
            logger.error(f"Understat {understat_league} error: {e}")
            return {}

    async def fetch_match_xg(self, understat_league: str, season: str = CURRENT_SEASON) -> List[Dict]:
        """
        리그의 경기별 xG 데이터를 가져옵니다.
        
        Returns:
            [
                {
                    "date": "2025-08-15",
                    "home": "Arsenal", "away": "Wolves",
                    "home_goals": 2, "away_goals": 0,
                    "home_xG": 2.45, "away_xG": 0.67,
                    "result": "h"
                },
                ...
            ]
        """
        url = f"{self.base_url}/league/{understat_league}/{season}"

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=self._headers)
                if resp.status_code != 200:
                    return []

                html = resp.text
                dates_data_str = self._extract_json_var(html, "datesData")
                if not dates_data_str:
                    return []

                dates_data = json.loads(dates_data_str)
                matches = []

                for match in dates_data:
                    matches.append({
                        "match_id": match.get("id", ""),
                        "date": match.get("datetime", "")[:10],
                        "home": match.get("h", {}).get("title", ""),
                        "away": match.get("a", {}).get("title", ""),
                        "home_goals": int(match.get("goals", {}).get("h", 0) or 0),
                        "away_goals": int(match.get("goals", {}).get("a", 0) or 0),
                        "home_xG": round(float(match.get("xG", {}).get("h", 0) or 0), 3),
                        "away_xG": round(float(match.get("xG", {}).get("a", 0) or 0), 3),
                        "result": match.get("result", ""),
                        "is_result": match.get("isResult", False),
                    })

                completed = [m for m in matches if m["is_result"]]
                logger.info(f"✅ Understat {understat_league}: {len(completed)} matches with xG")
                return completed

        except Exception as e:
            logger.error(f"Understat match xG error: {e}")
            return []

    async def get_team_xg(self, team_name: str, league_key: str) -> Optional[Dict]:
        """특정 팀의 xG 통계를 반환 (캐시 우선)."""
        # 캐시에서 찾기
        if league_key in self._cache:
            for name, stats in self._cache[league_key].items():
                if team_name.lower() in name.lower() or name.lower() in team_name.lower():
                    return stats
        
        # 캐시 없으면 수집
        understat_league = None
        for ustat_key, internal_key in UNDERSTAT_LEAGUES.items():
            if internal_key == league_key:
                understat_league = ustat_key
                break
        
        if not understat_league:
            return None

        teams = await self.fetch_league_teams_xg(understat_league)
        if teams:
            self._cache[league_key] = teams
            for name, stats in teams.items():
                if team_name.lower() in name.lower() or name.lower() in team_name.lower():
                    return stats
        return None

    async def collect_all_leagues(self) -> Dict:
        """모든 지원 리그의 xG 데이터를 수집합니다."""
        result = {}
        for understat_league, internal_key in UNDERSTAT_LEAGUES.items():
            teams = await self.fetch_league_teams_xg(understat_league)
            if teams:
                result[internal_key] = teams
                self._cache[internal_key] = teams
        
        self._last_fetch = datetime.now(timezone.utc).isoformat()
        logger.info(f"✅ Understat xG collection complete: {len(result)} leagues")
        return result

    def get_cached(self) -> Dict:
        """캐시된 전체 xG 데이터 반환."""
        return self._cache

    def get_status(self) -> Dict:
        """서비스 상태 반환."""
        return {
            "service": "Understat xG",
            "leagues_cached": list(self._cache.keys()),
            "teams_total": sum(len(v) for v in self._cache.values()),
            "last_fetch": self._last_fetch,
        }


# Singleton
understat_service = UnderstatXGService()

