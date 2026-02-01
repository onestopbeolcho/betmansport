import httpx
import time
import logging
from typing import List, Optional, Dict
from app.services.base_provider import BaseOddsProvider
from app.schemas.odds import OddsItem
import traceback

logger = logging.getLogger(__name__)

class PinnacleService(BaseOddsProvider):
    def __init__(self):
        super().__init__("Pinnacle")
        self.api_key: Optional[str] = None
        self.base_url = "https://api.the-odds-api.com/v4"
        self._cache = []
        self._last_fetch_time = 0.0
        self._cache_duration = 300 # 5 minutes
        # Major leagues supported by Betman
        self.target_sports = [
            "soccer_epl",
            "soccer_spain_la_liga",
            "soccer_germany_bundesliga",
            "soccer_italy_serie_a",
            "soccer_france_ligue_one",
            "soccer_uefa_champs_league"
        ]

    def set_api_key(self, api_key: str):
        self.api_key = api_key

    def fetch_odds(self) -> List[OddsItem]:
        if not self.api_key or "mock" in self.api_key.lower():
            logger.info("Using Mock Data (The Odds API structure).")
            return self._get_mock_data()
            
        # Check Cache
        current_time = time.time()
        if self._cache and (current_time - self._last_fetch_time < self._cache_duration):
            logger.info(f"Returning Cached Data ({len(self._cache)} items). Age: {int(current_time - self._last_fetch_time)}s")
            return self._cache
            
        logger.info("Cache expired. Fetching Real Data...")
        try:
            real_data = self._fetch_real_data()
            if real_data:
                logger.info(f"Successfully fetched {len(real_data)} items. Cache updated.")
                self._cache = real_data
                self._last_fetch_time = current_time
                return real_data
        except Exception as e:
            logger.error(f"The Odds API Fetch Error: {e}")
            traceback.print_exc()
            if self._cache:
                logger.warning("Returning stale cache due to error.")
                return self._cache
        
        return []

    def _fetch_real_data(self) -> List[OddsItem]:
        all_odds = []
        for sport in self.target_sports: 
            url = f"{self.base_url}/sports/{sport}/odds"
            params = {
                "apiKey": self.api_key,
                "regions": "eu",
                "markets": "h2h",
                "oddsFormat": "decimal",
                "bookmakers": "pinnacle"
            }
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.get(url, params=params)
                    if resp.status_code != 200:
                        logger.warning(f"Failed to fetch {sport}: {resp.status_code}")
                        continue
                    
                    data = resp.json()
                    parsed = self._parse_the_odds_api_response(data)
                    all_odds.extend(parsed)
            except Exception as e:
                logger.error(f"Error fetching {sport}: {e}")
        return all_odds

    def _parse_the_odds_api_response(self, data: List[Dict]) -> List[OddsItem]:
        items = []
        for event in data:
            home_team = event.get("home_team")
            away_team = event.get("away_team")
            commence_time = event.get("commence_time")
            
            bookmakers = event.get("bookmakers", [])
            pinnacle = next((b for b in bookmakers if b["key"] == "pinnacle"), None)
            if not pinnacle: continue
                
            markets = pinnacle.get("markets", [])
            h2h = next((m for m in markets if m["key"] == "h2h"), None)
            if not h2h: continue
                
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
                    
            if home_odds > 0 and away_odds > 0:
                items.append(OddsItem(
                    provider=self.provider_name,
                    sport="Soccer",
                    league=event.get("sport_title", "Unknown"),
                    team_home=home_team,
                    team_away=away_team,
                    home_odds=home_odds,
                    draw_odds=draw_odds,
                    away_odds=away_odds,
                    match_time=commence_time
                ))
        return items

    def _get_mock_data(self) -> List[OddsItem]:
        return [
            OddsItem(
                provider="Pinnacle (Mock)",
                sport="Soccer",
                league="EPL",
                team_home="Man City",
                team_away="Liverpool",
                home_odds=2.10,
                draw_odds=3.50,
                away_odds=3.20,
                match_time="2025-05-20T19:00:00Z"
            ),
            OddsItem(
                provider="Pinnacle (Mock)", 
                sport="Soccer",
                league="La Liga",
                team_home="Real Madrid",
                team_away="Barcelona",
                home_odds=1.95,
                draw_odds=3.60,
                away_odds=3.80,
                match_time="2025-05-21T19:00:00Z"
            )
        ]
