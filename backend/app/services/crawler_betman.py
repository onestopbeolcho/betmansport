"""
Betman Crawler — 베트맨 프로토 승부식 경기/배당 크롤러
- requests 세션 기반 WAF 우회 (쿠키 자동 관리)
- httpx 폴백
- 크롤링 성공 시 betman_db에 자동 저장
- 실패 시 마지막 저장 데이터로 폴백
- 재시도 로직 + 활성 회차 우선 필터링
"""
from typing import List, Optional, Tuple
import requests as req_lib
import httpx
from datetime import datetime, timezone
import json
import traceback
import logging
import time
import warnings

from app.services.base_provider import BaseOddsProvider
from app.schemas.odds import OddsItem

# Lazy import to avoid Firestore initialization on module load
# (allows local usage without Firebase credentials)
def _get_betman_db():
    try:
        from app.models.betman_db import save_betman_round, get_betman_matches, get_betman_status
        return save_betman_round, get_betman_matches, get_betman_status
    except Exception:
        return None, None, None

# Suppress SSL warnings for Betman
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

logger = logging.getLogger(__name__)

# Retry config
MAX_RETRIES = 2
RETRY_DELAY_BASE = 2.0  # seconds (exponential backoff)

# URLs
BASE_URL = "https://www.betman.co.kr" # Global URLs — Use CACHE API for 24/7 availability (non-purchase hours)
DISCOVERY_URL = "https://www.betman.co.kr/buyPsblGame/inqCacheBuyAbleGameInfoList.do"
DISCOVERY_URL_FALLBACK = "https://www.betman.co.kr/buyPsblGame/inqBuyAbleGameInfoList.do"
ODDS_URL = f"{BASE_URL}/buyPsblGame/gameInfoInq.do"
MAIN_PAGE_URL = f"{BASE_URL}/"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


class BetmanCrawler(BaseOddsProvider):
    def __init__(self):
        super().__init__("Betman")
        self.base_url = BASE_URL
        self.last_round_id = None
        self._session = None

    def _get_session(self) -> req_lib.Session:
        """Get or create a requests session with Betman cookies."""
        if self._session is None:
            self._session = req_lib.Session()
            self._session.verify = False
            self._session.headers.update({"User-Agent": UA})
            
            # Acquire cookies by visiting the main page
            try:
                logger.info("Acquiring Betman session cookies...")
                resp = self._session.get(MAIN_PAGE_URL, timeout=15)
                cookies = list(self._session.cookies.keys())
                logger.info(f"Session established: status={resp.status_code}, cookies={cookies}")
                time.sleep(0.3)  # Small delay after cookie acquisition
            except Exception as e:
                logger.warning(f"Failed to acquire cookies: {e}")
        
        return self._session

    def fetch_odds(self) -> List[OddsItem]:
        """
        Main entry point. 3-tier strategy:
        1. Browser crawl (Playwright) — WAF 완전 우회
        2. HTTP crawl (requests/httpx) — 빠르지만 WAF 차단 가능
        3. Saved DB fallback — 마지막 저장 데이터
        """
        # --- Strategy 1: Browser crawl (Playwright) ---
        browser_data = self._try_browser_crawl()
        if browser_data:
            return browser_data

        # --- Strategy 2: HTTP crawl (requests + httpx) ---
        try:
            real_data, round_id = self._fetch_real_data()
            if real_data and len(real_data) > 0:
                matches_dicts = [self._odds_to_dict(item) for item in real_data]
                save_fn, _, _ = _get_betman_db()
                if save_fn:
                    try:
                        save_fn(str(round_id), matches_dicts)
                    except Exception as e:
                        logger.warning(f"DB save failed (non-critical): {e}")
                logger.info(f"✅ Betman HTTP: {len(real_data)} items (round: {round_id})")
                return real_data
        except Exception as e:
            logger.error(f"HTTP crawl error: {e}")

        # --- Strategy 3: Saved DB fallback ---
        logger.warning("All crawl strategies failed. Loading from saved DB.")
        return self._load_from_db()

    def _try_browser_crawl(self) -> Optional[List[OddsItem]]:
        """Attempt Playwright browser crawl. Returns None if browser unavailable."""
        try:
            from app.services.crawler_betman_browser import crawl_betman_via_browser
            logger.info("🌐 Attempting browser-based crawl (Playwright)...")
            
            result = crawl_betman_via_browser(headless=True)
            
            if result["success"] and result["matches"]:
                # Convert match dicts to OddsItems
                items = []
                for m in result["matches"]:
                    items.append(OddsItem(
                        provider="Betman",
                        sport=m.get("sport", "Soccer"),
                        league=m.get("league", ""),
                        team_home=m.get("team_home", ""),
                        team_away=m.get("team_away", ""),
                        home_odds=float(m.get("home_odds", 0)),
                        draw_odds=float(m.get("draw_odds", 0)),
                        away_odds=float(m.get("away_odds", 0)),
                        match_time=m.get("match_time", ""),
                    ))
                
                # Save to DB
                self.last_round_id = result["round_id"]
                save_fn, _, _ = _get_betman_db()
                if save_fn:
                    try:
                        save_fn(str(result["round_id"]), result["matches"])
                    except Exception as e:
                        logger.warning(f"DB save failed (non-critical): {e}")
                logger.info(f"✅ Browser crawl: {len(items)} items (round: {result['round_id']})")
                return items
            else:
                error = result.get("error", "No matches found")
                logger.warning(f"Browser crawl returned no data: {error}")
                return None
                
        except ImportError:
            logger.info("Playwright not available, skipping browser crawl")
            return None
        except Exception as e:
            logger.warning(f"Browser crawl failed: {e}")
            return None

    def _fetch_real_data(self) -> Tuple[List[OddsItem], Optional[str]]:
        """Attempt to crawl Betman. Returns (items, round_id)."""
        # 1. Discover Active Round (gmTs)
        gm_ts, gm_id = self._discover_round_id()
        if not gm_ts:
            logger.warning("No active round found from Betman API")
            return [], None

        self.last_round_id = gm_ts
        logger.info(f"📌 Using round: gmId={gm_id}, gmTs={gm_ts}")

        # 2. Fetch Odds Data
        data = self._fetch_odds_page(gm_id, gm_ts)
        if not data:
            return [], str(gm_ts)

        # 3. Parse Data
        items = self._parse_response(data)
        logger.info(f"🔍 Parsed {len(items)} matches from round {gm_ts}")
        return items, str(gm_ts)

    def _discover_round_id(self) -> Tuple[Optional[int], Optional[str]]:
        """
        Find the active round ID (gmTs) for Proto Match (G101).
        Uses requests session for cookie management (WAF bypass).
        Priority: mainState == '1' (발매중) > mainState == '2' (발매마감, 최신)
        """
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{self.base_url}/main/mainPage/gamebuy/buyableGameList.do",
            "Origin": self.base_url,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json; charset=UTF-8",
        }

        # Double-nested _sbmInfo — 베트맨 requestClient.js 프레임워크의 요구사항
        payload = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}

        for attempt in range(MAX_RETRIES + 1):
            try:
                session = self._get_session()
                resp = session.post(DISCOVERY_URL, headers=headers, json=payload, timeout=15)

                content_type = resp.headers.get("content-type", "")
                logger.info(f"Discovery response: status={resp.status_code}, ct={content_type}, len={len(resp.content)} (attempt {attempt + 1})")

                if resp.status_code != 200:
                    logger.error(f"Discovery API Error: HTTP {resp.status_code}")
                    self._retry_delay(attempt)
                    continue

                # Check for HTML error page (WAF block or error)
                if "text/html" in content_type:
                    if "페이지 오류" in resp.text[:500]:
                        logger.error(f"Betman returned error page (attempt {attempt + 1})")
                    else:
                        logger.error(f"Unexpected HTML response (attempt {attempt + 1})")
                    
                    # Reset session for next attempt
                    self._session = None
                    self._retry_delay(attempt)
                    continue

                data = resp.json()
                status_msg = data.get("rsMsg", {}).get("message", "N/A")
                logger.info(f"Discovery OK: {status_msg}")

                return self._select_best_round(data)

            except req_lib.exceptions.Timeout:
                logger.error(f"Discovery timeout (attempt {attempt + 1})")
                self._retry_delay(attempt)
            except req_lib.exceptions.ConnectionError as e:
                logger.error(f"Discovery connection error: {e} (attempt {attempt + 1})")
                self._session = None  # Reset session
                self._retry_delay(attempt)
            except Exception as e:
                logger.error(f"Discovery Error: {e}")
                self._retry_delay(attempt)

        # All retries failed — try httpx as last resort
        return self._discover_round_id_httpx()

    def _discover_round_id_httpx(self) -> Tuple[Optional[int], Optional[str]]:
        """Fallback: try httpx for discovery."""
        logger.info("Trying httpx fallback for discovery...")
        headers = {
            "User-Agent": UA,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{self.base_url}/main/mainPage/gamebuy/buyableGameList.do",
            "Origin": self.base_url,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json; charset=UTF-8",
        }
        payload = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
        try:
            with httpx.Client(verify=False, timeout=15.0) as client:
                resp = client.post(DISCOVERY_URL, headers=headers, json=payload)
                ct = resp.headers.get("content-type", "")
                if resp.status_code == 200 and "application/json" in ct:
                    data = resp.json()
                    logger.info("httpx fallback succeeded!")
                    return self._select_best_round(data)
                else:
                    logger.error(f"httpx fallback failed: {resp.status_code}, ct={ct}")
        except Exception as e:
            logger.error(f"httpx fallback error: {e}")
        return None, None

    def _select_best_round(self, data: dict) -> Tuple[Optional[int], Optional[str]]:
        """Select the best available round from API response data."""
        proto_games = data.get("protoGames", [])
        logger.info(f"Found {len(proto_games)} proto games")

        # --- Priority 1: Active G101 (발매중, mainState == "1") ---
        for game in proto_games:
            if game.get("gmId") == "G101" and str(game.get("mainState")) == "1":
                gm_ts = game.get("gmTs")
                logger.info(f"✅ Active G101 round: gmTs={gm_ts} (발매중)")
                return gm_ts, "G101"

        # --- Priority 2: Any active proto game ---
        for game in proto_games:
            if str(game.get("mainState")) == "1":
                gm_ts = game.get("gmTs")
                gm_id = game.get("gmId")
                name = game.get("gameMaster", {}).get("gameName", "Unknown")
                logger.info(f"⚠️ Active {gm_id}: gmTs={gm_ts} ({name})")
                return gm_ts, gm_id

        # --- Priority 3: Latest closed G101 (폴백) ---
        for game in proto_games:
            if game.get("gmId") == "G101":
                gm_ts = game.get("gmTs")
                msg = game.get("mainStatusMessage", "")
                logger.info(f"📁 Closed G101 fallback: gmTs={gm_ts} ({msg})")
                return gm_ts, "G101"

        # --- Priority 4: Any available proto ---
        if proto_games:
            g = proto_games[0]
            gm_ts = g.get("gmTs")
            gm_id = g.get("gmId")
            logger.info(f"📁 First available: {gm_id}, gmTs={gm_ts}")
            return gm_ts, gm_id

        logger.warning("No proto games in response")
        return None, None

    def _fetch_odds_page(self, gm_id: str, gm_ts) -> Optional[dict]:
        """Fetch game data JSON from gameInfoInq.do."""
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": f"{self.base_url}/main/mainPage/gamebuy/buyableGameList.do",
            "Origin": self.base_url,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json; charset=UTF-8",
        }

        payload = {
            "gmId": gm_id,
            "gmTs": gm_ts,
            "gameYear": "",
            "_sbmInfo": {"_sbmInfo": {"debugMode": "false"}},
        }

        for attempt in range(MAX_RETRIES + 1):
            try:
                session = self._get_session()
                resp = session.post(ODDS_URL, headers=headers, json=payload, timeout=15)

                content_type = resp.headers.get("content-type", "")
                logger.info(f"Odds API response: status={resp.status_code}, ct={content_type}, len={len(resp.content)} (attempt {attempt + 1})")

                if resp.status_code == 200:
                    if "text/html" in content_type:
                        logger.error("Odds API returned HTML (WAF/error)")
                        self._session = None
                        self._retry_delay(attempt)
                        continue

                    try:
                        data = resp.json()
                        if "compSchedules" in data:
                            keys_count = len(data["compSchedules"].get("keys", []))
                            data_count = len(data["compSchedules"].get("datas", []))
                            logger.info(f"✅ Odds data: {keys_count} columns, {data_count} rows")
                        else:
                            logger.warning(f"No compSchedules in response. Keys: {list(data.keys())}")
                        return data
                    except json.JSONDecodeError:
                        logger.error("Failed to decode JSON from odds API")
                        return None
                else:
                    logger.error(f"Odds API HTTP {resp.status_code}")
                    self._retry_delay(attempt)

            except req_lib.exceptions.Timeout:
                logger.error(f"Odds API timeout (attempt {attempt + 1})")
                self._retry_delay(attempt)
            except Exception as e:
                logger.error(f"Fetch Odds Error: {e}")
                self._retry_delay(attempt)

        return None

    def _parse_response(self, data: dict) -> List[OddsItem]:
        """Parse the JSON data from gameInfoInq.do into OddsItems."""
        odds_items = []
        if not data or "compSchedules" not in data:
            logger.warning("No compSchedules — round may be closed or empty")
            return []

        try:
            keys = data["compSchedules"]["keys"]
            datas = data["compSchedules"]["datas"]

            if not datas:
                logger.info("compSchedules.datas is empty (no matches in this round)")
                return []

            idx_map = {k: i for i, k in enumerate(keys)}

            key_sport = idx_map.get("itemCode")
            key_league = idx_map.get("leagueName")
            key_home = idx_map.get("homeName")
            key_away = idx_map.get("awayName")
            key_date = idx_map.get("gameDate")
            key_win = idx_map.get("winAllot")
            key_draw = idx_map.get("drawAllot")
            key_lose = idx_map.get("loseAllot")
            key_handi = idx_map.get("handi")
            key_status = idx_map.get("protoStatus")
            key_match_seq = idx_map.get("matchSeq")

            sport_map = {
                "SC": "Soccer",
                "BS": "Baseball",
                "BK": "Basketball",
                "VL": "Volleyball",
                "IC": "Ice Hockey",
            }

            skipped = {"inactive": 0, "handicap": 0, "parse_error": 0, "no_odds": 0}

            for row in datas:
                handi = row[key_handi] if key_handi is not None else 0
                status = row[key_status] if key_status is not None else "0"

                # Filter: Active status (2 = 배당확정) + Standard (no handicap variants)
                if str(status) != "2":
                    skipped["inactive"] += 1
                    continue
                if handi not in [0, 15, 16]:
                    skipped["handicap"] += 1
                    continue

                try:
                    match_time_ms = row[key_date] if key_date is not None else 0
                    match_time = datetime.fromtimestamp(
                        match_time_ms / 1000.0, timezone.utc
                    ).isoformat() if match_time_ms else ""

                    sport_code = row[key_sport] if key_sport is not None else "SC"
                    home_odds = float(row[key_win]) if row[key_win] else 0.0
                    draw_odds = float(row[key_draw]) if row[key_draw] else 0.0
                    away_odds = float(row[key_lose]) if row[key_lose] else 0.0

                    # Skip invalid odds
                    if home_odds <= 0 and away_odds <= 0:
                        skipped["no_odds"] += 1
                        continue

                    item = OddsItem(
                        provider=self.provider_name,
                        sport=sport_map.get(sport_code, "Unknown"),
                        league=row[key_league] if key_league is not None else "",
                        team_home=row[key_home] if key_home is not None else "",
                        team_away=row[key_away] if key_away is not None else "",
                        home_odds=home_odds,
                        draw_odds=draw_odds,
                        away_odds=away_odds,
                        match_time=match_time,
                    )
                    odds_items.append(item)
                except Exception as ex:
                    skipped["parse_error"] += 1
                    logger.warning(f"Error parsing row: {ex}")
                    continue

            logger.info(f"Parse result: {len(odds_items)} valid, skipped={skipped}")

        except Exception as e:
            logger.error(f"Parse Error: {e}")
            traceback.print_exc()

        return odds_items

    def _load_from_db(self) -> List[OddsItem]:
        """Load last saved Betman data from local JSON DB."""
        try:
            _, get_matches_fn, _ = _get_betman_db()
            if not get_matches_fn:
                logger.info("Firestore not available, no DB fallback.")
                return []
            matches = get_matches_fn()
            if not matches:
                logger.info("No saved Betman data available.")
                return []

            items = []
            for m in matches:
                try:
                    items.append(OddsItem(
                        provider="Betman",
                        sport=m.get("sport", "Soccer"),
                        league=m.get("league", ""),
                        team_home=m.get("team_home", ""),
                        team_away=m.get("team_away", ""),
                        home_odds=float(m.get("home_odds", 0)),
                        draw_odds=float(m.get("draw_odds", 0)),
                        away_odds=float(m.get("away_odds", 0)),
                        match_time=m.get("match_time", ""),
                    ))
                except Exception:
                    continue

            logger.info(f"📂 Loaded {len(items)} matches from saved Betman DB")
            return items
        except Exception as e:
            logger.error(f"Error loading from DB: {e}")
            return []

    def _retry_delay(self, attempt: int):
        """Exponential backoff delay for retries."""
        if attempt < MAX_RETRIES:
            delay = RETRY_DELAY_BASE * (2 ** attempt)
            logger.info(f"Retrying in {delay:.1f}s... (attempt {attempt + 1}/{MAX_RETRIES})")
            time.sleep(delay)

    @staticmethod
    def _odds_to_dict(item: OddsItem) -> dict:
        """Convert OddsItem to dict for DB storage."""
        return {
            "provider": item.provider,
            "sport": item.sport or "Soccer",
            "league": item.league or "",
            "team_home": item.team_home,
            "team_away": item.team_away,
            "home_odds": item.home_odds,
            "draw_odds": item.draw_odds,
            "away_odds": item.away_odds,
            "match_time": item.match_time or "",
        }
