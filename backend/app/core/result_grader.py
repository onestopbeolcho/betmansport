"""
Result Grader — 경기 결과 자동 정산 엔진

API-Football fixtures 엔드포인트로 결과를 가져오고,
배트맨(Betman) 정산 규정에 따라 베팅을 판정합니다.

배트맨 규정:
- ⚽ 축구: 연장전 제외, 전후반 90분 결과만 인정
- ⚾ 야구 / 🏀 농구 / 🏒 아이스하키: 연장전 포함 최종 결과
- 🌧️ 우천 취소 / 경기 연기: 배당률 1.0배 처리 (PUSH)
"""
import logging
import os
import httpx
from typing import Optional, Dict, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ResultGrader:
    """
    Grades betting portfolio items against actual game results.
    Fetches scores from API-Football fixtures and applies Betman-specific rules.
    """

    def __init__(self):
        # API key: API_FOOTBALL_KEY 우선, PINNACLE_API_KEY 폴백 (하위호환)
        self.api_key = os.getenv("API_FOOTBALL_KEY") or os.getenv("PINNACLE_API_KEY", "")
        self._scores_cache: Dict[str, dict] = {}
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = 300  # 5 minutes

    # ──────────────────────────────────────────────
    # 1. Fetch scores from API-Football
    # ──────────────────────────────────────────────
    async def fetch_all_scores(self, days_from: int = 3) -> List[dict]:
        """
        Fetch completed game scores from API-Football.
        Returns list of result dicts with scores.
        """
        if not self.api_key:
            logger.warning("No API key configured, cannot fetch scores")
            return []

        # Check cache
        if (self._cache_time and self._scores_cache and
                (datetime.utcnow() - self._cache_time).total_seconds() < self._cache_ttl):
            logger.info(f"Serving {len(self._scores_cache)} scores from cache")
            return list(self._scores_cache.values())

        # API-Football에서 경기 결과 조회
        try:
            from app.services.football_stats_service import FootballStatsService
            fs = FootballStatsService()
            finished = await fs.fetch_finished_fixtures(days_back=days_from)
        except Exception as e:
            logger.error(f"Failed to fetch finished fixtures: {e}")
            return list(self._scores_cache.values())

        # 결과를 캐시에 저장 (The Odds API 호환 형식으로 변환)
        all_scores = []
        self._scores_cache = {}
        for fix in finished:
            key = self._make_match_key(fix.get("home_team", ""), fix.get("away_team", ""))
            # API-Football 결과를 기존 파서와 호환되는 형식으로 변환
            event = {
                "home_team": fix.get("home_team", ""),
                "away_team": fix.get("away_team", ""),
                "home_score": fix.get("fulltime_home", fix.get("home_score", 0)),
                "away_score": fix.get("fulltime_away", fix.get("away_score", 0)),
                "completed": True,
                "status": fix.get("status", "Finished"),
                "sport_key": fix.get("sport_key", "soccer"),
                "commence_time": fix.get("commence_time", ""),
            }
            self._scores_cache[key] = event
            all_scores.append(event)

        self._cache_time = datetime.utcnow()
        logger.info(f"📊 Total scores fetched: {len(all_scores)}")
        return all_scores

    # ──────────────────────────────────────────────
    # 2. Find score for a specific match
    # ──────────────────────────────────────────────
    async def fetch_result(self, team_home: str, team_away: str) -> Optional[Dict]:
        """
        Look up the result for a specific match from cached scores.
        Returns parsed result dict or None.
        """
        if not self._scores_cache:
            await self.fetch_all_scores()

        key = self._make_match_key(team_home, team_away)
        event = self._scores_cache.get(key)

        if not event:
            # Try reverse order
            key_rev = self._make_match_key(team_away, team_home)
            event = self._scores_cache.get(key_rev)

        if not event:
            # Fuzzy match: partial team name
            for cached_key, cached_event in self._scores_cache.items():
                if (team_home.lower() in cached_key.lower() or
                        team_away.lower() in cached_key.lower()):
                    event = cached_event
                    break

        if not event:
            return None

        return self._parse_scores(event)

    def _parse_scores(self, event: dict) -> Optional[Dict]:
        """
        Parse score event into usable format.
        Supports API-Football format (primary) and legacy The Odds API format.
        """
        # API-Football 형식 (직접 home_score/away_score 필드)
        if "home_score" in event:
            home_team = event.get("home_team", "")
            away_team = event.get("away_team", "")
            home_score = event.get("home_score", 0)
            away_score = event.get("away_score", 0)
            completed = event.get("completed", True)
            sport_key = event.get("sport_key", "soccer")
            status = "Finished" if completed else "InProgress"
            sport = self._detect_sport(sport_key)

            return {
                "home_team": home_team,
                "away_team": away_team,
                "home_score": home_score,
                "away_score": away_score,
                "status": status,
                "sport": sport,
                "sport_key": sport_key,
                "commence_time": event.get("commence_time"),
            }

        # 레거시 The Odds API 형식 (scores 배열)
        scores = event.get("scores")
        completed = event.get("completed", False)

        if not scores:
            return None

        home_team = event.get("home_team", "")
        away_team = event.get("away_team", "")
        sport_key = event.get("sport_key", "")

        home_score = 0
        away_score = 0
        for s in scores:
            name = s.get("name", "")
            score_val = s.get("score", "0")
            try:
                score_int = int(score_val)
            except (ValueError, TypeError):
                score_int = 0

            if name == home_team:
                home_score = score_int
            elif name == away_team:
                away_score = score_int

        status = "Finished" if completed else "InProgress"
        sport = self._detect_sport(sport_key)

        return {
            "home_team": home_team,
            "away_team": away_team,
            "home_score": home_score,
            "away_score": away_score,
            "status": status,
            "sport": sport,
            "sport_key": sport_key,
            "commence_time": event.get("commence_time"),
        }

    # ──────────────────────────────────────────────
    # 3. Grade a single bet (Betman rules)
    # ──────────────────────────────────────────────
    def grade_bet(self, selection: str, result_score: Dict, sport: str = "") -> str:
        """
        Determines if the bet won or lost based on Betman rules.
        
        Args:
            selection: User's pick ('Home', 'Draw', 'Away')
            result_score: {'home_score': int, 'away_score': int, 'status': str}
            sport: 'soccer', 'baseball', 'basketball', 'icehockey'
        
        Returns:
            'WIN', 'LOSS', 'PUSH', 'PENDING', 'CANCELLED'
        """
        status = result_score.get("status", "")
        
        # Not finished yet
        if status not in ("Finished", "Final"):
            return "PENDING"

        # 🌧️ 경기 취소/연기 → PUSH (배당률 1.0배)
        if status in ("Cancelled", "Postponed", "Suspended"):
            logger.info(f"Match cancelled/postponed → PUSH")
            return "PUSH"

        home_score = result_score.get("home_score", 0)
        away_score = result_score.get("away_score", 0)
        sport_lower = (sport or result_score.get("sport", "")).lower()

        # Determine actual result based on sport-specific rules
        actual = self._determine_result(home_score, away_score, sport_lower)

        # Normalize selection
        sel = selection.strip().capitalize()
        if sel in ("Home", "홈"):
            sel = "Home"
        elif sel in ("Draw", "무", "무승부"):
            sel = "Draw"
        elif sel in ("Away", "원정"):
            sel = "Away"

        if sel == actual:
            return "WIN"
        else:
            return "LOSS"

    def _determine_result(self, home_score: int, away_score: int, sport: str) -> str:
        """
        Apply Betman-specific rules to determine match result.

        배트맨 규정:
        - 축구: 90분 결과만 (연장전 제외) → 무승부 가능
        - 야구: 연장 포함 최종 결과 (무승부 없음, 특수 규칙 제외)
        - 농구: 연장 포함 최종 결과 (무승부 없음)
        - 아이스하키: 연장 포함 최종 결과 (무승부 없음)

        Note: API-Football returns fulltime scores (90min) for soccer.
        """
        if "soccer" in sport:
            # Soccer: 90-minute result (draw possible)
            if home_score > away_score:
                return "Home"
            elif home_score < away_score:
                return "Away"
            else:
                return "Draw"
        else:
            # Baseball/Basketball/Hockey: Final result including OT
            # These sports rarely have draws
            if home_score > away_score:
                return "Home"
            elif home_score < away_score:
                return "Away"
            else:
                return "Draw"  # Rare but possible in MLB (suspended games)

    # ──────────────────────────────────────────────
    # 4. Grade an entire betting slip (multiple legs)
    # ──────────────────────────────────────────────
    async def grade_slip(self, slip: dict) -> Dict:
        """
        Grade all items in a betting slip.
        All legs must WIN for the slip to win (parlay/accumulator).
        
        Returns:
            {
                "status": "WON" | "LOST" | "PENDING" | "PARTIAL",
                "results": [{"match": str, "grade": str}, ...],
                "settled_count": int,
                "total_count": int,
            }
        """
        items = slip.get("items", [])
        if not items:
            return {"status": "PENDING", "results": [], "settled_count": 0, "total_count": 0}

        results = []
        all_grades = []

        for item in items:
            team_home = item.get("team_home", "")
            team_away = item.get("team_away", "")
            selection = item.get("selection", "")
            match_name = item.get("match_name", f"{team_home} vs {team_away}")

            # Try to fetch result
            score = await self.fetch_result(team_home, team_away)
            if score:
                grade = self.grade_bet(selection, score)
            else:
                grade = "PENDING"

            results.append({
                "match": match_name,
                "grade": grade,
                "score": f"{score['home_score']}-{score['away_score']}" if score else None,
            })
            all_grades.append(grade)

        settled_count = sum(1 for g in all_grades if g != "PENDING")
        total_count = len(all_grades)

        # Determine overall slip status
        if "LOSS" in all_grades:
            overall = "LOST"  # Any loss = slip loses
        elif all(g == "WIN" or g == "PUSH" for g in all_grades):
            if all(g == "PUSH" for g in all_grades):
                overall = "PUSH"
            else:
                overall = "WON"
        elif "PENDING" in all_grades:
            overall = "PARTIAL" if settled_count > 0 else "PENDING"
        else:
            overall = "PENDING"

        return {
            "status": overall,
            "results": results,
            "settled_count": settled_count,
            "total_count": total_count,
        }

    # ──────────────────────────────────────────────
    # 5. Utility
    # ──────────────────────────────────────────────
    def _make_match_key(self, home: str, away: str) -> str:
        return f"{home.strip().lower()}_vs_{away.strip().lower()}"

    def _detect_sport(self, sport_key: str) -> str:
        sk = sport_key.lower()
        if "soccer" in sk:
            return "soccer"
        elif "baseball" in sk:
            return "baseball"
        elif "basketball" in sk:
            return "basketball"
        elif "icehockey" in sk:
            return "icehockey"
        return "other"

    def clear_cache(self):
        """Force-clear the scores cache."""
        self._scores_cache = {}
        self._cache_time = None


# Singleton
result_grader = ResultGrader()
