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
        # API key: API_FOOTBALL_KEY 우선, PINNACLE_API_KEY 폴백 (하위호환)
        self.api_key: Optional[str] = os.getenv("API_FOOTBALL_KEY") or os.getenv("PINNACLE_API_KEY")
        self._cache = []
        self._last_fetch_time = 0.0
        self._cache_duration = 300  # 5 minutes
        self.team_mapper = TeamMapper()
        # Rate limiting
        self._requests_remaining: Optional[int] = None
        self._requests_used: int = 0
        # 지원 리그 (API-Football league IDs) — football_stats_service.LEAGUE_MAP과 동기화
        self.target_leagues = {
            # ─── 유럽 빅 5 ───
            "soccer_epl": 39,
            "soccer_spain_la_liga": 140,
            "soccer_germany_bundesliga": 78,
            "soccer_italy_serie_a": 135,
            "soccer_france_ligue_one": 61,
            # ─── 유럽 기타 1부 ───
            "soccer_netherlands_eredivisie": 88,
            "soccer_portugal_liga": 94,
            "soccer_belgium_pro_league": 144,
            "soccer_turkey_super_lig": 203,
            "soccer_scotland_premiership": 179,
            "soccer_switzerland_super_league": 207,
            "soccer_austria_bundesliga": 218,
            "soccer_denmark_superliga": 119,
            "soccer_norway_eliteserien": 103,
            "soccer_sweden_allsvenskan": 113,
            "soccer_greece_super_league": 197,
            "soccer_czech_first_league": 345,
            "soccer_poland_ekstraklasa": 106,
            "soccer_croatia_hnl": 210,
            "soccer_serbia_superliga": 286,
            # ─── 대회 ───
            "soccer_uefa_champs_league": 2,
            "soccer_uefa_europa_league": 3,
            "soccer_uefa_europa_conference_league": 848,
            # ─── 아시아 ───
            "soccer_korea_kleague": 292,
            "soccer_japan_jleague": 98,
            "soccer_china_super_league": 169,
            "soccer_australia_aleague": 188,
            "soccer_saudi_pro_league": 307,
            "soccer_india_super_league": 323,
            # ─── 아메리카 ───
            "soccer_usa_mls": 253,
            "soccer_brazil_serie_a": 71,
            "soccer_mexico_liga_mx": 262,
            "soccer_argentina_liga": 128,
            # ─── 아프리카 ───
            "soccer_egypt_premier_league": 233,
        }

        if self.api_key:
            logger.info(f"✅ API-Football Key loaded for odds (len={len(self.api_key)})")
        else:
            logger.warning("⚠️ No API_FOOTBALL_KEY/PINNACLE_API_KEY found — will use mock data")

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
                    parsed = self._parse_firestore_cache_odds(data)
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
        스케줄러 전용 — API-Football에서 최신 배당을 가져와 Firestore에 저장.
        이 메서드만 외부 API를 호출합니다.
        """
        if not self.api_key or self.api_key.strip() == "":
            logger.warning("No API Key configured. Cannot refresh odds.")
            return []

        cache_key = "odds_snapshot"
        logger.info("🔄 [Scheduler] Refreshing odds from API-Football...")

        try:
            # API-Football에서 배당 수집
            from app.services.football_stats_service import FootballStatsService
            fs = FootballStatsService()
            raw_odds = await fs.fetch_all_odds()

            if raw_odds:
                # API-Football 데이터를 OddsItem으로 파싱
                parsed = self._parse_api_football_odds(raw_odds)
                # Update in-memory cache
                self._cache = parsed
                self._last_fetch_time = time.time()
                # Save to Firestore for persistence across cold starts
                try:
                    await set_market_cache(cache_key, json.dumps(raw_odds))
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
                logger.info(f"✅ [Scheduler] Refreshed {len(parsed)} odds from API-Football")
                return parsed
        except Exception as e:
            logger.error(f"❌ [Scheduler] API-Football Refresh Error: {e}")
            traceback.print_exc()

        return []

    def _parse_api_football_odds(self, raw_odds: List[Dict]) -> List[OddsItem]:
        """API-Football fetch_all_odds() 결과를 OddsItem으로 변환"""
        items = []
        for o in raw_odds:
            home_team = o.get("home_team", "")
            away_team = o.get("away_team", "")
            if not home_team or not away_team:
                continue

            home_ko = self.team_mapper.get_korean_name(home_team)
            away_ko = self.team_mapper.get_korean_name(away_team)

            bookmaker = o.get("bookmaker", "Pinnacle")
            provider_name = f"Pinnacle" if "pinnacle" in bookmaker.lower() else f"Pinnacle ({bookmaker})"

            items.append(OddsItem(
                provider=provider_name,
                sport=o.get("sport", "Soccer"),
                league=o.get("league", "Unknown"),
                team_home=home_team,
                team_away=away_team,
                team_home_ko=home_ko,
                team_away_ko=away_ko,
                home_odds=o.get("home_odds", 0.0),
                draw_odds=o.get("draw_odds", 0.0),
                away_odds=o.get("away_odds", 0.0),
                match_time=o.get("match_time", ""),
            ))
        return items

    def _parse_firestore_cache_odds(self, data: List[Dict]) -> List[OddsItem]:
        """
        Firestore 캐시에서 읽은 API-Football 형식 배당 데이터 파싱.
        (기존 The Odds API 형식도 하위 호환)
        """
        items = []
        for o in data:
            # API-Football 형식 (home_team 키 존재)
            if "home_team" in o:
                home_team = o.get("home_team", "")
                away_team = o.get("away_team", "")
                if not home_team or not away_team:
                    continue

                home_ko = self.team_mapper.get_korean_name(home_team)
                away_ko = self.team_mapper.get_korean_name(away_team)

                bookmaker = o.get("bookmaker", "Pinnacle")
                provider_name = f"Pinnacle" if "pinnacle" in bookmaker.lower() else f"Pinnacle ({bookmaker})"

                items.append(OddsItem(
                    provider=provider_name,
                    sport=o.get("sport", "Soccer"),
                    league=o.get("league", "Unknown"),
                    team_home=home_team,
                    team_away=away_team,
                    team_home_ko=home_ko,
                    team_away_ko=away_ko,
                    home_odds=o.get("home_odds", 0.0),
                    draw_odds=o.get("draw_odds", 0.0),
                    away_odds=o.get("away_odds", 0.0),
                    match_time=o.get("match_time", ""),
                ))
            # 레거시 The Odds API 형식 (home_team 키 없이 bookmakers 배열)
            elif "bookmakers" in o:
                home_team = o.get("home_team", "")
                away_team = o.get("away_team", "")
                home_ko = self.team_mapper.get_korean_name(home_team)
                away_ko = self.team_mapper.get_korean_name(away_team)
                bookmakers = o.get("bookmakers", [])
                pinnacle_or_other = next((b for b in bookmakers if b["key"] == "pinnacle"), None)
                if not pinnacle_or_other and bookmakers:
                    pinnacle_or_other = bookmakers[0]
                if not pinnacle_or_other:
                    continue
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
                if home_odds > 0 and away_odds > 0:
                    items.append(OddsItem(
                        provider="Pinnacle",
                        sport="Soccer",
                        league=o.get("sport_title", "Unknown"),
                        team_home=home_team,
                        team_away=away_team,
                        team_home_ko=home_ko,
                        team_away_ko=away_ko,
                        home_odds=home_odds,
                        draw_odds=draw_odds,
                        away_odds=away_odds,
                        match_time=o.get("commence_time", ""),
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
        """캐시된 배당 데이터 반환 (AI Predictor + MatchVoting 용)"""
        if self._cache:
            return self._cache
        # Cold start: Firestore 캐시에서 읽기 시도 (동기 호출)
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # 이미 이벤트루프가 실행 중이면 fetch_odds를 사용하도록
                # _warmup_cache에서 미리 로드되었어야 함
                pass
            else:
                result = loop.run_until_complete(self.fetch_odds())
                if result:
                    return result
        except Exception as e:
            logger.warning(f"Cold-start Firestore cache read failed: {e}")
        # 최종 폴백: Mock 데이터로라도 경기 표시
        return self._get_mock_data()

    # ─── 참고용 The Odds API (무료 500건/월) ───
    _ref_odds_cache: List[OddsItem] = []

    async def fetch_reference_odds(self, sports: List[str] = None) -> List[OddsItem]:
        """
        The Odds API 무료 플랜(500건/월)에서 배당 참고 데이터 수집.
        주의: 월 500건 한도이므로 수동 호출 or 1일 1회만 사용.
        주력 배당은 API-Football, 이것은 교차 검증용.
        """
        ref_key = os.getenv("ODDS_API_KEY") or os.getenv("PINNACLE_API_KEY", "")
        if not ref_key:
            logger.info("No ODDS_API_KEY — skipping reference odds")
            return []

        base_url = "https://api.the-odds-api.com/v4"
        target = sports or [
            "soccer_epl", "soccer_spain_la_liga", "soccer_germany_bundesliga",
            "soccer_italy_serie_a", "soccer_france_ligue_one",
        ]

        items = []
        async with httpx.AsyncClient(timeout=15.0) as client:
            for sport in target:
                url = f"{base_url}/sports/{sport}/odds"
                params = {
                    "apiKey": ref_key,
                    "regions": "eu",
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                    "bookmakers": "pinnacle,bet365",
                }
                try:
                    resp = await client.get(url, params=params)
                    remaining = resp.headers.get("x-requests-remaining")
                    if remaining:
                        logger.info(f"  📌 Odds API ref quota: {remaining} remaining")

                    if resp.status_code == 401:
                        logger.error("❌ Odds API ref key invalid")
                        break
                    if resp.status_code == 429:
                        logger.warning("⚠️ Odds API ref rate limit")
                        break
                    if resp.status_code != 200:
                        continue

                    data = resp.json()
                    for event in data:
                        home_team = event.get("home_team", "")
                        away_team = event.get("away_team", "")
                        bookmakers = event.get("bookmakers", [])
                        for bk in bookmakers:
                            markets = bk.get("markets", [])
                            h2h = next((m for m in markets if m["key"] == "h2h"), None)
                            if not h2h:
                                continue
                            home_odds = draw_odds = away_odds = 0.0
                            for o in h2h.get("outcomes", []):
                                if o["name"] == home_team:
                                    home_odds = o["price"]
                                elif o["name"] == away_team:
                                    away_odds = o["price"]
                                elif o["name"] == "Draw":
                                    draw_odds = o["price"]
                            if home_odds > 0 and away_odds > 0:
                                items.append(OddsItem(
                                    provider=f"Ref:{bk.get('title', bk.get('key', 'Unknown'))}",
                                    sport="Soccer",
                                    league=event.get("sport_title", ""),
                                    team_home=home_team,
                                    team_away=away_team,
                                    team_home_ko=self.team_mapper.get_korean_name(home_team),
                                    team_away_ko=self.team_mapper.get_korean_name(away_team),
                                    home_odds=home_odds,
                                    draw_odds=draw_odds,
                                    away_odds=away_odds,
                                    match_time=event.get("commence_time", ""),
                                ))
                    logger.info(f"  📌 {sport}: {len(data)} ref events")
                except Exception as e:
                    logger.warning(f"Odds API ref error ({sport}): {e}")

        self._ref_odds_cache = items
        logger.info(f"📌 Reference odds: {len(items)} total from The Odds API free tier")
        return items

    def get_reference_odds_cache(self) -> List[OddsItem]:
        """참고용 The Odds API 캐시 반환"""
        return self._ref_odds_cache

pinnacle_service = PinnacleService()

