from typing import List, Optional
import httpx
from bs4 import BeautifulSoup
from datetime import datetime
import traceback
import logging

from app.services.base_provider import BaseOddsProvider
from app.schemas.odds import OddsItem

# Configure logger
logger = logging.getLogger(__name__)

class BetmanCrawler(BaseOddsProvider):
    def __init__(self):
        super().__init__("Betman")
        self.base_url = "https://www.betman.co.kr"

    def fetch_odds(self) -> List[OddsItem]:
        """
        Main entry point.
        Attempts to fetch real data. If blocked/fails, returns Mock data.
        """
        try:
            real_data = self._fetch_real_data()
            if real_data and len(real_data) > 0:
                logger.info(f"Successfully fetched {len(real_data)} items from Betman.")
                print(f"✅ Betman: Fetched {len(real_data)} real items.")
                return real_data
            else:
                logger.warning("Failed to fetch real data or found 0 items. Using Mock Data.")
                print("⚠️ Betman: Fetch failed/empty. Using Mock Data.")
                return self._get_mock_data()
        except Exception as e:
            logger.error(f"Error in fetch_odds: {e}")
            traceback.print_exc()
            return self._get_mock_data()

    def _fetch_real_data(self) -> List[OddsItem]:
        # 1. Discover Active Round (gmTs)
        gm_ts, gm_id = self._discover_round_id()
        if not gm_ts:
            return []

        # 2. Fetch Odds Page
        html = self._fetch_odds_page(gm_id, gm_ts)
        if not html:
            return []

        # 3. Parse Data
        return self._parse_html(html)

    def _discover_round_id(self) -> (Optional[str], Optional[str]):
        """
        Attempts to find the active round ID (gmTs) for Proto Match (G101).
        """
        api_url = f"{self.base_url}/buyPsblGame/inqBuyAbleGameInfoList.do"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": f"{self.base_url}/main/mainPage/gamebuy/buyableGameList.do",
            "Origin": self.base_url,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        }
        
        try:
            # Use sync Client
            with httpx.Client(verify=False, timeout=10.0) as client:
                resp = client.post(api_url, headers=headers, data={})
                if resp.status_code != 200:
                    logger.error(f"API Error: {resp.status_code}")
                    return None, None
                
                # Check for HTML response (WAF Block)
                if "text/html" in resp.headers.get("content-type", ""):
                    logger.error("API Blocked (Received HTML)")
                    return None, None
                
                data = resp.json()
                # Find G101
                if "protoGames" in data:
                    for game in data.get("protoGames", []):
                        if game.get("gmId") == "G101":
                            return game.get("gmTs"), "G101"
                            
                # Fallback to first available
                if data.get("protoGames"):
                    g = data["protoGames"][0]
                    return g.get("gmTs"), g.get("gmId")
                    
        except Exception as e:
            logger.error(f"Discovery Error: {e}")
            
        return None, None

    def _fetch_odds_page(self, gm_id: str, gm_ts: str) -> Optional[str]:
        target_url = f"{self.base_url}/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId={gm_id}&gmTs={gm_ts}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": f"{self.base_url}/main/mainPage/gamebuy/buyableGameList.do",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        }
        try:
            with httpx.Client(verify=False, timeout=15.0) as client:
                resp = client.get(target_url, headers=headers)
                if resp.status_code == 200:
                    return resp.text
        except Exception as e:
            logger.error(f"Fetch Page Error: {e}")
        return None

    def _parse_html(self, html: str) -> List[OddsItem]:
        soup = BeautifulSoup(html, 'html.parser')
        odds_items = []
        
        # TODO: Implement actual parsing logic once we have the HTML structure.
        # This is currently a placeholder that looks for generic tables
        # typical of Betman (tbl, buyableList, etc.)
        
        # Pattern usually: specific tr rows with team names
        rows = soup.find_all('tr')
        for row in rows:
            # Placeholder for future logic
            pass
            
        return odds_items

    def _get_mock_data(self) -> List[OddsItem]:
        return [
            OddsItem(
                provider=self.provider_name,
                team_home="맨체스터 시티 (Mock)",
                team_away="리버풀 (Mock)",
                home_odds=2.30,  # Value Bet!
                draw_odds=3.30,
                away_odds=3.40,
                match_time="2023-10-25T20:00:00Z"
            ),
            OddsItem(
                provider=self.provider_name,
                team_home="아스널 (Mock)",
                team_away="첼시 (Mock)",
                home_odds=1.70,  # No Value
                draw_odds=3.40,
                away_odds=3.90,
                match_time="2023-10-26T15:00:00Z"
            )
        ]
