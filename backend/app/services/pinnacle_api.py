import httpx
import time
import logging
import os
from typing import List, Optional, Dict
from app.services.base_provider import BaseOddsProvider
from app.schemas.odds import OddsItem
from app.services.team_mapper import TeamMapper
import traceback
import json
import datetime
from app.models.bets_db import get_market_cache, set_market_cache

logger = logging.getLogger(__name__)

class PinnacleService(BaseOddsProvider):
    def __init__(self):
        super().__init__("Pinnacle")
        # Auto-load API key from environment
        self.api_key: Optional[str] = os.getenv("PINNACLE_API_KEY")
        self.base_url = "https://api.the-odds-api.com/v4"
        self._cache = []
        self._last_fetch_time = 0.0
        self._cache_duration = 300  # 5 minutes
        self.team_mapper = TeamMapper()
        # Rate limiting
        self._requests_remaining: Optional[int] = None
        self._requests_used: int = 0
        # Multi-sport leagues
        self.target_sports = [
            # Soccer
            "soccer_epl",
            "soccer_spain_la_liga",
            "soccer_germany_bundesliga",
            "soccer_italy_serie_a",
            "soccer_france_ligue_one",
            "soccer_uefa_champs_league",
            # Basketball
            "basketball_nba",
            "basketball_euroleague",
            # Baseball
            "baseball_mlb",
            # Ice Hockey
            "icehockey_nhl",
        ]

        if self.api_key:
            logger.info(f"✅ Odds API Key loaded (len={len(self.api_key)})")
        else:
            logger.warning("⚠️ No PINNACLE_API_KEY found — will use mock data")

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        logger.info(f"API key updated (len={len(api_key)})")

    async def fetch_odds(self, db=None, force_fresh: bool = False) -> List[OddsItem]:
        """
        사용자 요청용 — Firestore/메모리 캐시에서만 읽기.
        절대로 외부 API를 호출하지 않습니다.
        토큰 소모: 0
        """
        if not self.api_key or self.api_key.strip() == "":
            logger.info("No API Key configured. Using Mock Data.")
            return self._get_mock_data()

        cache_key = "odds_snapshot"

        # 1. Try in-memory cache first (fastest)
        if self._cache and len(self._cache) > 0:
            logger.info(f"Serving from in-memory cache ({len(self._cache)} items)")
            return self._cache

        # 2. Try Firestore cache (persists across cold starts)
        try:
            cached_data = await get_market_cache(cache_key)
            if cached_data and cached_data.get("data"):
                logger.info("Serving from Firestore cache")
                try:
                    data = json.loads(cached_data["data"])
                    parsed = self._parse_the_odds_api_response(data)
                    # Populate in-memory cache for next request
                    self._cache = parsed
                    self._last_fetch_time = time.time()
                    return parsed
                except Exception as e:
                    logger.warning(f"Failed to parse Firestore cache: {e}")
        except Exception as e:
            logger.warning(f"Firestore cache unavailable: {e}")

        # 3. No cache available — return mock data (NOT external API)
        logger.warning("No cached odds available. Returning mock data until scheduler runs.")
        return self._get_mock_data()

    async def refresh_odds(self) -> List[OddsItem]:
        """
        스케줄러 전용 — The Odds API에서 최신 배당을 가져와 Firestore에 저장.
        이 메서드만 외부 API를 호출합니다.
        토큰 소모: ~10 (리그 10개)
        """
        if not self.api_key or self.api_key.strip() == "":
            logger.warning("No API Key configured. Cannot refresh odds.")
            return []

        cache_key = "odds_snapshot"
        logger.info("🔄 [Scheduler] Refreshing odds from The Odds API...")

        try:
            raw_data = await self._fetch_raw_odds_data()
            if raw_data:
                parsed = self._parse_the_odds_api_response(raw_data)
                # Update in-memory cache
                self._cache = parsed
                self._last_fetch_time = time.time()
                # Save to Firestore for persistence across cold starts
                try:
                    await set_market_cache(cache_key, json.dumps(raw_data))
                    logger.info("✅ Saved to Firestore cache")
                except Exception as e:
                    logger.warning(f"Firestore cache save failed: {e}")
                # Save odds history snapshots for chart
                try:
                    from app.models.bets_db import save_odds_snapshots_batch
                    snapshot_items = [
                        {
                            "team_home": p.team_home,
                            "team_away": p.team_away,
                            "home_odds": p.home_odds,
                            "draw_odds": p.draw_odds,
                            "away_odds": p.away_odds,
                            "league": p.league or "",
                        }
                        for p in parsed
                    ]
                    await save_odds_snapshots_batch(snapshot_items)
                    logger.info(f"📊 Saved {len(snapshot_items)} odds history snapshots")
                except Exception as e:
                    logger.warning(f"History snapshot save failed (non-critical): {e}")
                logger.info(f"✅ [Scheduler] Refreshed {len(parsed)} odds from API")
                return parsed
        except Exception as e:
            logger.error(f"❌ [Scheduler] API Refresh Error: {e}")
            traceback.print_exc()

        return []


    async def _fetch_raw_odds_data(self) -> List[Dict]:
        all_odds = []
        async with httpx.AsyncClient(timeout=15.0) as client:
            for sport in self.target_sports:
                # Rate limit protection
                if self._requests_remaining is not None and self._requests_remaining <= 5:
                    logger.warning(f"Rate limit near ({self._requests_remaining} remaining). Stopping.")
                    break

                url = f"{self.base_url}/sports/{sport}/odds"
                params = {
                    "apiKey": self.api_key,
                    "regions": "eu",
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                    "bookmakers": "pinnacle,bet365,williamhill,unibet"
                }
                try:
                    resp = await client.get(url, params=params)
                    self._requests_used += 1

                    # Track rate limits from response headers
                    remaining = resp.headers.get("x-requests-remaining")
                    if remaining:
                        self._requests_remaining = int(remaining)
                        logger.info(f"API quota: {remaining} requests remaining")

                    if resp.status_code == 401:
                        logger.error("❌ API Key is invalid (401 Unauthorized)")
                        break
                    elif resp.status_code == 429:
                        logger.error("❌ Rate limit exceeded (429)")
                        break
                    elif resp.status_code != 200:
                        logger.warning(f"Failed to fetch {sport}: HTTP {resp.status_code}")
                        continue

                    data = resp.json()
                    logger.info(f"  {sport}: {len(data)} events")
                    all_odds.extend(data)
                except httpx.TimeoutException:
                    logger.warning(f"Timeout fetching {sport}")
                except Exception as e:
                    logger.error(f"Error fetching {sport}: {e}")

        logger.info(f"Total raw events fetched: {len(all_odds)}")
        return all_odds

    def _parse_the_odds_api_response(self, data: List[Dict]) -> List[OddsItem]:
        items = []
        for event in data:
            home_team = event.get("home_team")
            away_team = event.get("away_team")
            commence_time = event.get("commence_time")

            home_ko = self.team_mapper.get_korean_name(home_team)
            away_ko = self.team_mapper.get_korean_name(away_team)

            bookmakers = event.get("bookmakers", [])
            pinnacle_or_other = next((b for b in bookmakers if b["key"] == "pinnacle"), None)
            if not pinnacle_or_other and bookmakers:
                pinnacle_or_other = bookmakers[0]

            if not pinnacle_or_other:
                continue

            provider_name = "Pinnacle" if pinnacle_or_other['key'] == 'pinnacle' else f"Pinnacle ({pinnacle_or_other['title']})"

            markets = pinnacle_or_other.get("markets", [])
            h2h = next((m for m in markets if m["key"] == "h2h"), None)
            if not h2h:
                continue

            outcomes = h2h.get("outcomes", [])
            home_odds, draw_odds, away_odds = 0.0, 0.0, 0.0

            for out in outcomes:
                name = out["name"]
                price = out["price"]
                if name == home_team:
                    home_odds = price
                elif name == away_team:
                    away_odds = price
                elif name == "Draw":
                    draw_odds = price

            sport_key = event.get("sport_key", "").lower()
            if "soccer" in sport_key:
                sport_name = "Soccer"
            elif "baseball" in sport_key:
                sport_name = "Baseball"
            elif "basketball" in sport_key:
                sport_name = "Basketball"
            elif "icehockey" in sport_key:
                sport_name = "IceHockey"
            else:
                sport_name = event.get("sport_title", "Other")

            if home_odds > 0 and away_odds > 0:
                items.append(OddsItem(
                    provider=provider_name,
                    sport=sport_name,
                    league=event.get("sport_title", "Unknown"),
                    team_home=home_team,
                    team_away=away_team,
                    team_home_ko=home_ko,
                    team_away_ko=away_ko,
                    home_odds=home_odds,
                    draw_odds=draw_odds,
                    away_odds=away_odds,
                    match_time=commence_time
                ))
        return items

    def _get_mock_data(self) -> List[OddsItem]:
        """Dynamic mock data — dates are always relative to today."""
        now = datetime.datetime.utcnow()
        return [
            OddsItem(
                provider="Pinnacle (Mock)",
                sport="Soccer",
                league="EPL",
                team_home="Man City",
                team_away="Liverpool",
                team_home_ko="맨체스터 시티",
                team_away_ko="리버풀",
                home_odds=1.80,
                draw_odds=3.50,
                away_odds=3.20,
                match_time=(now + datetime.timedelta(hours=3)).isoformat() + "Z"
            ),
            OddsItem(
                provider="Pinnacle (Mock)",
                sport="Soccer",
                league="La Liga",
                team_home="Real Madrid",
                team_away="Barcelona",
                team_home_ko="레알 마드리드",
                team_away_ko="바르셀로나",
                home_odds=1.95,
                draw_odds=3.60,
                away_odds=3.80,
                match_time=(now + datetime.timedelta(days=1, hours=2)).isoformat() + "Z"
            ),
            OddsItem(
                provider="Pinnacle (Mock)",
                sport="Soccer",
                league="UEFA Champions League",
                team_home="Bayern Munich",
                team_away="PSG",
                team_home_ko="바이에른 뮌헨",
                team_away_ko="파리 생제르맹",
                home_odds=1.65,
                draw_odds=3.90,
                away_odds=4.50,
                match_time=(now + datetime.timedelta(days=2, hours=5)).isoformat() + "Z"
            ),
            OddsItem(
                provider="Pinnacle (Mock)",
                sport="Soccer",
                league="Serie A",
                team_home="AC Milan",
                team_away="Inter Milan",
                team_home_ko="AC 밀란",
                team_away_ko="인터 밀란",
                home_odds=2.40,
                draw_odds=3.30,
                away_odds=2.75,
                match_time=(now + datetime.timedelta(days=3)).isoformat() + "Z"
            ),
            OddsItem(
                provider="Pinnacle (Mock)",
                sport="Soccer",
                league="Bundesliga",
                team_home="Borussia Dortmund",
                team_away="RB Leipzig",
                team_home_ko="도르트문트",
                team_away_ko="RB 라이프치히",
                home_odds=2.10,
                draw_odds=3.40,
                away_odds=3.10,
                match_time=(now + datetime.timedelta(days=1, hours=6)).isoformat() + "Z"
            ),
        ]

    def get_cached_odds(self) -> List[OddsItem]:
        """캐시된 배당 데이터 반환 (AI Predictor용)"""
        return self._cache if self._cache else []

pinnacle_service = PinnacleService()

