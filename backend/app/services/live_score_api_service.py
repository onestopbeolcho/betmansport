"""
Live-Score-Api 연동 서비스
- 실시간 라이브 스코어 (600 req/hr 무료)
- 매치 이벤트 (골, 카드, 교체)
- 라인업 정보
- Base URL: https://livescore-api.com/api-client
- Docs: https://live-score-api.com/documentation
"""
import httpx
import logging
import os
from typing import List, Dict, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class LiveScoreApiService:
    """Live-Score-Api 전용 서비스 (실시간 스코어)"""

    def __init__(self):
        self.api_key = os.getenv("LIVE_SCORE_API_KEY", "")
        self.api_secret = os.getenv("LIVE_SCORE_API_SECRET", "")
        self.base_url = "https://livescore-api.com/api-client"

        # Rate limiting (600 req/hr)
        self._hourly_requests = 0
        self._hourly_limit = 600
        self._hour_start: Optional[datetime] = None

        # Cache
        self._live_cache: Dict = {}
        self._live_cache_time: Optional[datetime] = None
        self._live_cache_ttl = 30  # 30초 캐시

        self._lineups_cache: Dict[int, Dict] = {}
        self._lineups_cache_time: Dict[int, datetime] = {}
        self._lineups_cache_ttl = 300  # 5분 캐시

        self._events_cache: Dict[int, Dict] = {}
        self._events_cache_time: Dict[int, datetime] = {}
        self._events_cache_ttl = 30  # 30초 캐시

        if self.api_key and self.api_secret:
            logger.info("✅ Live-Score-Api key loaded")
        else:
            logger.warning("⚠️ No LIVE_SCORE_API_KEY/SECRET — live scores via fallback only")

    @property
    def is_available(self) -> bool:
        return bool(self.api_key and self.api_secret)

    def _auth_params(self) -> Dict:
        """인증 파라미터"""
        return {"key": self.api_key, "secret": self.api_secret}

    def _can_request(self) -> bool:
        """Rate limit 확인"""
        if not self.is_available:
            return False

        now = datetime.now(timezone.utc)

        # 시간 리셋
        if self._hour_start is None or (now - self._hour_start).total_seconds() >= 3600:
            self._hourly_requests = 0
            self._hour_start = now

        if self._hourly_requests >= self._hourly_limit:
            logger.warning(f"⚠️ Live-Score-Api hourly limit reached ({self._hourly_requests}/{self._hourly_limit})")
            return False

        return True

    async def _get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """API 요청 + rate limit tracking"""
        if not self._can_request():
            return None

        url = f"{self.base_url}/{endpoint}"
        request_params = {**self._auth_params(), **(params or {})}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=request_params)
                self._hourly_requests += 1

                if resp.status_code != 200:
                    logger.warning(f"Live-Score-Api {endpoint}: HTTP {resp.status_code}")
                    return None

                data = resp.json()

                if not data.get("success"):
                    error = data.get("error", "Unknown error")
                    logger.warning(f"Live-Score-Api {endpoint}: {error}")
                    return None

                logger.info(
                    f"  ⚽ Live-Score-Api /{endpoint}: "
                    f"(requests: {self._hourly_requests}/{self._hourly_limit}/hr)"
                )
                return data.get("data", {})

        except Exception as e:
            logger.error(f"Live-Score-Api error: {e}")
            return None

    # ─── Status Mapping ───
    STATUS_MAP = {
        "NOT STARTED": "NS",
        "IN PLAY": "2H",       # 기본적으로 후반전으로 처리 (time으로 보정)
        "HALF TIME BREAK": "HT",
        "ADDED TIME": "ET",
        "FINISHED": "FT",
        "AFTER EXTRA TIME": "AET",
        "AFTER PENALTIES": "AP",
        "POSTPONED": "PST",
        "CANCELLED": "CANC",
        "SUSPENDED": "SUSP",
        "INTERRUPTED": "INT",
        "ABANDONED": "ABD",
    }

    def _map_status(self, status: str, elapsed_time: Optional[int] = None) -> str:
        """Live-Score-Api 상태 → 표준 코드 매핑"""
        mapped = self.STATUS_MAP.get(status, status)

        # IN PLAY 시 경과 시간으로 전/후반 판별
        if status == "IN PLAY" and elapsed_time is not None:
            if elapsed_time <= 45:
                mapped = "1H"
            else:
                mapped = "2H"

        return mapped

    def _parse_score(self, score_str: str) -> tuple:
        """'2 - 1' 형태 점수 파싱"""
        try:
            parts = score_str.strip().split(" - ")
            return int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            return 0, 0

    # ─── Live Scores (실시간 스코어) ───
    async def fetch_live_scores(self, competition_id: Optional[int] = None) -> List[Dict]:
        """현재 실시간 진행 중인 경기 스코어 조회
        - 30초 캐시 적용
        - 경기 종료 후 ~3시간까지 피드에 유지됨
        """
        now = datetime.now(timezone.utc)

        # 캐시 유효성 검사
        if (self._live_cache_time and
            (now - self._live_cache_time).total_seconds() < self._live_cache_ttl and
            self._live_cache.get("matches")):
            matches = self._live_cache["matches"]
            if competition_id:
                matches = [m for m in matches if m.get("competition_id") == competition_id]
            return matches

        # API 조회
        params = {}
        if competition_id:
            params["competition_id"] = competition_id

        data = await self._get("scores/live.json", params)
        if not data:
            return self._live_cache.get("matches", [])

        matches = []
        try:
            for match in data.get("match", []):
                home = match.get("home", {})
                away = match.get("away", {})
                scores = match.get("scores", {})
                competition = match.get("competition", {})
                country = match.get("country", {})
                odds = match.get("odds", {})

                # 점수 파싱
                home_goals, away_goals = self._parse_score(scores.get("score", "0 - 0"))
                ht_home, ht_away = self._parse_score(scores.get("ht_score", ""))

                # 경과 시간
                elapsed = None
                time_str = match.get("time", "")
                if time_str and time_str.isdigit():
                    elapsed = int(time_str)

                match_info = {
                    "match_id": match.get("id"),
                    "fixture_id": match.get("fixture_id"),
                    "status": self._map_status(match.get("status", ""), elapsed),
                    "status_long": match.get("status", ""),
                    "elapsed": elapsed or 0,
                    "home": home.get("name", ""),
                    "away": away.get("name", ""),
                    "home_id": home.get("id"),
                    "away_id": away.get("id"),
                    "home_logo": home.get("logo", ""),
                    "away_logo": away.get("logo", ""),
                    "home_goals": home_goals,
                    "away_goals": away_goals,
                    "halftime": {
                        "home": ht_home,
                        "away": ht_away,
                    },
                    "competition_id": competition.get("id"),
                    "league_id": competition.get("id"),  # 호환용
                    "league_name": competition.get("name", ""),
                    "league_country": country.get("name", ""),
                    "league_logo": "",  # Live-Score-Api는 리그 로고 미제공
                    "location": match.get("location", ""),
                    "scheduled": match.get("scheduled", ""),
                    "odds": {
                        "pre": odds.get("pre", {}),
                        "live": odds.get("live", {}),
                    },
                    "events_url": match.get("urls", {}).get("events", ""),
                    "lineups_url": match.get("urls", {}).get("lineups", ""),
                    "h2h_url": match.get("urls", {}).get("head2head", ""),
                    "source": "live-score-api",
                }
                matches.append(match_info)
        except Exception as e:
            logger.error(f"Parse live scores error: {e}")

        # 캐시 갱신
        self._live_cache = {"matches": matches, "updated_at": now.isoformat()}
        self._live_cache_time = now
        logger.info(f"⚽ Live-Score-Api: {len(matches)} matches in progress")

        if competition_id:
            return [m for m in matches if m.get("competition_id") == competition_id]
        return matches

    # ─── Match Events (경기 이벤트) ───
    async def fetch_match_events(self, match_id: int) -> Optional[Dict]:
        """경기 이벤트 조회 (골, 카드, 교체)
        - 30초 캐시 적용
        """
        now = datetime.now(timezone.utc)

        # 캐시 확인
        cached_time = self._events_cache_time.get(match_id)
        if cached_time and (now - cached_time).total_seconds() < self._events_cache_ttl:
            return self._events_cache.get(match_id)

        data = await self._get("scores/events.json", {"id": match_id})
        if not data:
            return self._events_cache.get(match_id)

        events = []
        try:
            for ev in data.get("event", []):
                event_type = ev.get("event", "").lower()

                # 이벤트 타입 매핑
                mapped_type = "other"
                detail = ev.get("event", "")
                if "goal" in event_type:
                    mapped_type = "Goal"
                    if "own" in event_type:
                        detail = "Own Goal"
                    elif "penalty" in event_type:
                        detail = "Penalty"
                    else:
                        detail = "Normal Goal"
                elif "yellow" in event_type:
                    mapped_type = "Card"
                    detail = "Yellow Card"
                elif "red" in event_type or "second yellow" in event_type:
                    mapped_type = "Card"
                    detail = "Red Card"
                elif "substitution" in event_type or "sub" in event_type:
                    mapped_type = "subst"
                    detail = "Substitution"

                events.append({
                    "time": ev.get("time", ""),
                    "type": mapped_type,
                    "detail": detail,
                    "player": ev.get("player", ""),
                    "team": ev.get("home_away", ""),
                    "score": ev.get("score", ""),
                })
        except Exception as e:
            logger.error(f"Parse events error: {e}")

        result = {"match_id": match_id, "events": events, "count": len(events)}

        # 캐시 갱신
        self._events_cache[match_id] = result
        self._events_cache_time[match_id] = now

        return result

    # ─── Match Lineups (라인업) ───
    async def fetch_match_lineups(self, match_id: int) -> Optional[Dict]:
        """경기 라인업 조회
        - 5분 캐시 적용 (라인업은 자주 안 변함)
        """
        now = datetime.now(timezone.utc)

        # 캐시 확인
        cached_time = self._lineups_cache_time.get(match_id)
        if cached_time and (now - cached_time).total_seconds() < self._lineups_cache_ttl:
            return self._lineups_cache.get(match_id)

        data = await self._get("matches/lineups.json", {"match_id": match_id})
        if not data:
            return self._lineups_cache.get(match_id)

        lineups = {"home": {}, "away": {}}
        try:
            for side in ["home", "away"]:
                team_data = data.get(side, {})

                players = []
                for player in team_data.get("players", []):
                    players.append({
                        "name": player.get("name", ""),
                        "number": player.get("shirt_number", 0),
                        "pos": player.get("position", ""),
                        "is_substitute": player.get("is_substitute", False),
                    })

                # 선발 / 교체 분리
                starters = [p for p in players if not p.get("is_substitute")]
                subs = [p for p in players if p.get("is_substitute")]

                lineups[side] = {
                    "team_name": team_data.get("name", ""),
                    "formation": team_data.get("formation", ""),
                    "starters": starters,
                    "substitutes": subs,
                    "coach": team_data.get("coach", ""),
                }
        except Exception as e:
            logger.error(f"Parse lineups error: {e}")

        result = {"match_id": match_id, "lineups": lineups}

        # 캐시 갱신
        self._lineups_cache[match_id] = result
        self._lineups_cache_time[match_id] = now

        return result

    # ─── Cache Getters ───
    def get_live_cache(self) -> Dict:
        """캐시된 라이브 스코어 반환"""
        return self._live_cache

    def get_stats(self) -> Dict:
        """서비스 통계"""
        return {
            "available": self.is_available,
            "hourly_requests": self._hourly_requests,
            "hourly_limit": self._hourly_limit,
            "cache_matches": len(self._live_cache.get("matches", [])),
            "cache_updated": self._live_cache.get("updated_at", ""),
        }
