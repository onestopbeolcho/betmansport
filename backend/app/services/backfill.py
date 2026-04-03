"""
Historical Data Backfill — 과거 시즌 데이터 소급 수집.
API-Football에서 완료된 경기 결과를 가져와 BigQuery에 적재.
이 데이터가 LightGBM ML 모델의 학습 데이터가 됨.

사용법:
  POST /api/scheduler/backfill_historical
  body: { "seasons": [2024, 2025], "leagues": ["soccer_epl", ...] }
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# API-Football league IDs
LEAGUE_MAP = {
    "soccer_epl": 39,
    "soccer_spain_la_liga": 140,
    "soccer_germany_bundesliga": 78,
    "soccer_italy_serie_a": 135,
    "soccer_france_ligue_one": 61,
    "soccer_uefa_champs_league": 2,
    "soccer_korea_kleague1": 292,
}

# All target leagues for backfill
ALL_LEAGUES = list(LEAGUE_MAP.keys())


class HistoricalBackfill:
    """API-Football → BigQuery 과거 데이터 소급 수집 엔진."""

    def __init__(self):
        import os
        self.api_key = os.getenv("API_FOOTBALL_KEY", "")
        self.base_url = "https://v3.football.api-sports.io"
        self._request_count = 0
        self._total_matches = 0
        self._total_inserted = 0

    def _headers(self):
        return {"x-apisports-key": self.api_key}

    async def _get(self, endpoint: str, params: dict) -> Optional[dict]:
        """API-Football 요청 (rate limit 고려)."""
        url = f"{self.base_url}/{endpoint}"
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url, headers=self._headers(), params=params)
                self._request_count += 1

                if resp.status_code == 429:
                    logger.warning("Rate limited, waiting 60s...")
                    await asyncio.sleep(60)
                    resp = await client.get(url, headers=self._headers(), params=params)
                    self._request_count += 1

                if resp.status_code != 200:
                    logger.warning(f"API-Football {endpoint}: HTTP {resp.status_code}")
                    return None

                data = resp.json()
                if data.get("errors"):
                    logger.warning(f"API-Football errors: {data['errors']}")
                    return None

                return data
        except Exception as e:
            logger.error(f"API-Football request error: {e}")
            return None

    async def backfill_season(
        self,
        league_key: str,
        season: int,
    ) -> Dict:
        """
        한 리그/시즌의 전체 완료 경기를 수집.
        API-Football fixtures endpoint: /fixtures?league=X&season=Y&status=FT
        """
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return {"error": f"Unknown league: {league_key}"}

        logger.info(f"📥 Backfilling {league_key} season {season}...")

        # Fetch all finished fixtures for this league/season
        data = await self._get("fixtures", {
            "league": league_id,
            "season": season,
            "status": "FT",  # Full Time (completed)
        })

        if not data or not data.get("response"):
            return {"league": league_key, "season": season, "matches": 0, "error": "No data"}

        fixtures = data["response"]
        logger.info(f"  Found {len(fixtures)} completed fixtures")

        # Transform to BigQuery format
        rows = []
        for fixture in fixtures:
            try:
                fx = fixture.get("fixture", {})
                teams = fixture.get("teams", {})
                goals = fixture.get("goals", {})
                score = fixture.get("score", {})

                home_goals = goals.get("home", 0) or 0
                away_goals = goals.get("away", 0) or 0

                if home_goals > away_goals:
                    result = "HOME"
                elif away_goals > home_goals:
                    result = "AWAY"
                else:
                    result = "DRAW"

                match_id = str(fx.get("id", ""))
                match_date = fx.get("date", "")

                row = {
                    "match_id": match_id,
                    "league": league_key,
                    "season": str(season),
                    "home_team": teams.get("home", {}).get("name", ""),
                    "away_team": teams.get("away", {}).get("name", ""),
                    "match_date": match_date,
                    "home_score": home_goals,
                    "away_score": away_goals,
                    "result": result,
                    "status": "FT",
                    "venue": fx.get("venue", {}).get("name", ""),
                    "round": fixture.get("league", {}).get("round", ""),
                    "api_source": "api-football",
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                }
                rows.append(row)
            except Exception as e:
                logger.warning(f"Parse fixture error: {e}")
                continue

        # Insert into BigQuery
        if rows:
            try:
                from app.services import bigquery_service as bq
                inserted = await bq.insert_rows("matches_raw", rows)
                self._total_inserted += len(rows)
                logger.info(f"  ✅ Inserted {len(rows)} matches into BigQuery")
            except Exception as e:
                logger.error(f"  BigQuery insert error: {e}")
                return {"league": league_key, "season": season, "matches": len(rows), "error": str(e)}

        self._total_matches += len(rows)
        return {
            "league": league_key,
            "season": season,
            "matches": len(rows),
            "api_requests": self._request_count,
        }

    async def backfill_odds(self, league_key: str, season: int) -> Dict:
        """
        한 리그/시즌의 배당률 데이터 수집.
        API-Football odds endpoint: /odds?league=X&season=Y&bookmaker=4 (Pinnacle)
        """
        league_id = LEAGUE_MAP.get(league_key)
        if not league_id:
            return {"error": f"Unknown league: {league_key}"}

        logger.info(f"📊 Backfilling odds for {league_key} season {season}...")

        # Pinnacle bookmaker ID = 4 in API-Football
        data = await self._get("odds", {
            "league": league_id,
            "season": season,
            "bookmaker": 4,  # Pinnacle
        })

        if not data or not data.get("response"):
            # Try without specific bookmaker
            data = await self._get("odds", {
                "league": league_id,
                "season": season,
            })

        if not data or not data.get("response"):
            return {"league": league_key, "season": season, "odds_count": 0}

        odds_rows = []
        for item in data.get("response", []):
            fixture = item.get("fixture", {})
            match_id = str(fixture.get("id", ""))
            match_date = fixture.get("date", "")

            for bookmaker in item.get("bookmakers", []):
                bk_name = bookmaker.get("name", "unknown")
                for bet in bookmaker.get("bets", []):
                    if bet.get("name") == "Match Winner":
                        values = bet.get("values", [])
                        home_odd = draw_odd = away_odd = 0
                        for v in values:
                            val = v.get("value", "")
                            odd = float(v.get("odd", 0))
                            if val == "Home":
                                home_odd = odd
                            elif val == "Draw":
                                draw_odd = odd
                            elif val == "Away":
                                away_odd = odd

                        if home_odd > 0 and away_odd > 0:
                            odds_rows.append({
                                "match_id": match_id,
                                "bookmaker": bk_name,
                                "market": "match_winner",
                                "home_odds": home_odd,
                                "draw_odds": draw_odd,
                                "away_odds": away_odd,
                                "recorded_at": match_date or datetime.now(timezone.utc).isoformat(),
                                "source": "api-football",
                            })

        if odds_rows:
            try:
                from app.services import bigquery_service as bq
                await bq.insert_rows("odds_history", odds_rows)
                logger.info(f"  ✅ Inserted {len(odds_rows)} odds records")
            except Exception as e:
                logger.error(f"  Odds insert error: {e}")

        return {"league": league_key, "season": season, "odds_count": len(odds_rows)}

    async def run_full_backfill(
        self,
        seasons: List[int] = None,
        leagues: List[str] = None,
    ) -> Dict:
        """
        전체 과거 데이터 소급 수집 실행.
        하루 100건 제한 → 리그 수에 따라 여러 번 나눠서 실행 필요.
        """
        if seasons is None:
            seasons = [2024, 2025]
        if leagues is None:
            leagues = ALL_LEAGUES

        self._request_count = 0
        self._total_matches = 0
        self._total_inserted = 0

        results = []
        for season in seasons:
            for league in leagues:
                # Check rate limit (free tier: 100/day)
                if self._request_count >= 90:
                    logger.warning(f"⚠️ Approaching rate limit ({self._request_count} requests). Stopping.")
                    results.append({
                        "status": "rate_limit_reached",
                        "remaining_leagues": leagues[leagues.index(league):],
                        "remaining_seasons": seasons[seasons.index(season):],
                    })
                    return self._summary(results)

                # Fetch match results
                match_result = await self.backfill_season(league, season)
                results.append(match_result)

                # Throttle to avoid rate limiting
                await asyncio.sleep(2)

                # Fetch odds (if we have requests remaining)
                if self._request_count < 85:
                    odds_result = await self.backfill_odds(league, season)
                    results.append(odds_result)
                    await asyncio.sleep(2)

        return self._summary(results)

    def _summary(self, results: List[Dict]) -> Dict:
        total_matches = sum(r.get("matches", 0) for r in results)
        total_odds = sum(r.get("odds_count", 0) for r in results)
        errors = [r for r in results if r.get("error")]

        return {
            "status": "completed" if not errors else "partial",
            "total_matches_collected": total_matches,
            "total_odds_collected": total_odds,
            "api_requests_used": self._request_count,
            "details": results,
            "errors": errors if errors else None,
        }


# Singleton
backfill_engine = HistoricalBackfill()
