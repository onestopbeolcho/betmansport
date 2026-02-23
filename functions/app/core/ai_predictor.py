"""
AI 승리 예측 엔진
6가지 Factor 가중치 기반 경기 결과 예측
"""
import logging
from typing import List, Dict, Optional, Tuple
from app.schemas.predictions import MatchPrediction, TeamStats
from app.schemas.odds import OddsItem

logger = logging.getLogger(__name__)


class AIPredictor:
    """다중 소스 기반 AI 승리 예측 엔진"""

    # Factor weights (합계 = 1.0)
    WEIGHTS = {
        "implied_prob": 0.25,   # 배당률 기반 내재 확률
        "rank_diff": 0.20,     # 리그 순위 차이
        "recent_form": 0.20,   # 최근 5경기 폼
        "h2h": 0.15,           # 상대전적
        "venue": 0.10,         # 홈/어웨이 성적
        "injuries": 0.10,      # 부상/결장 영향
    }

    def __init__(self):
        self._standings_cache: Dict[str, List[TeamStats]] = {}
        self._injuries_cache: Dict[str, List] = {}
        self._predictions_cache: List[Dict] = []

    def update_data(self,
                     standings: Dict[str, List[TeamStats]] = None,
                     injuries: Dict[str, List] = None,
                     api_predictions: List[Dict] = None):
        """외부 데이터 업데이트"""
        if standings:
            self._standings_cache = standings
        if injuries:
            self._injuries_cache = injuries
        if api_predictions:
            self._predictions_cache = api_predictions

    # ─── Factor 1: 배당률 내재 확률 (25%) ───
    def _calc_implied_prob(self, odds: OddsItem) -> Tuple[float, float, float, Dict]:
        """배당률에서 마진 제거 후 내재 확률 산출"""
        if odds.home_odds <= 0 or odds.away_odds <= 0:
            return 33.3, 33.3, 33.3, {}

        imp_h = 1 / odds.home_odds
        imp_d = 1 / odds.draw_odds if odds.draw_odds > 0 else 0
        imp_a = 1 / odds.away_odds
        total = imp_h + imp_d + imp_a

        home_pct = (imp_h / total) * 100
        draw_pct = (imp_d / total) * 100
        away_pct = (imp_a / total) * 100

        detail = f"홈 {home_pct:.0f}% / 무 {draw_pct:.0f}% / 원정 {away_pct:.0f}%"
        return home_pct, draw_pct, away_pct, {
            "name": "배당률 내재 확률",
            "weight": self.WEIGHTS["implied_prob"],
            "detail": detail,
        }

    # ─── Factor 2: 리그 순위 차이 (20%) ───
    def _calc_rank_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """순위 차이 기반 승률 보정"""
        standings = self._standings_cache.get(league, [])
        home_rank = 0
        away_rank = 0

        for team in standings:
            name = team.team_name.lower() if isinstance(team, TeamStats) else team.get("team_name", "").lower()
            rank = team.rank if isinstance(team, TeamStats) else team.get("rank", 0)
            if home_team.lower() in name or name in home_team.lower():
                home_rank = rank
            if away_team.lower() in name or name in away_team.lower():
                away_rank = rank

        if home_rank == 0 or away_rank == 0:
            return 50, 50, {"name": "리그 순위", "weight": self.WEIGHTS["rank_diff"], "score": 50, "detail": "순위 데이터 없음"}

        # 순위 차이 → 확률 보정 (1위 vs 20위 = 큰 차이)
        total_teams = len(standings) or 20
        home_strength = ((total_teams - home_rank + 1) / total_teams) * 100
        away_strength = ((total_teams - away_rank + 1) / total_teams) * 100

        detail = f"홈 {home_rank}위 vs 원정 {away_rank}위"
        return home_strength, away_strength, {
            "name": "리그 순위",
            "weight": self.WEIGHTS["rank_diff"],
            "score": home_strength,
            "detail": detail,
            "home_rank": home_rank,
            "away_rank": away_rank,
        }

    # ─── Factor 3: 최근 폼 (20%) ───
    def _calc_form_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """최근 5경기 폼 분석"""
        standings = self._standings_cache.get(league, [])
        home_form = ""
        away_form = ""

        for team in standings:
            name = team.team_name.lower() if isinstance(team, TeamStats) else team.get("team_name", "").lower()
            form = team.form if isinstance(team, TeamStats) else team.get("form", "")
            if home_team.lower() in name or name in home_team.lower():
                home_form = form
            if away_team.lower() in name or name in away_team.lower():
                away_form = form

        def form_score(form_str: str) -> float:
            if not form_str:
                return 50
            recent = form_str[-5:]  # Last 5
            w = recent.count("W")
            d = recent.count("D")
            l = recent.count("L")
            total = w + d + l
            if total == 0:
                return 50
            return ((w * 3 + d * 1) / (total * 3)) * 100

        h_score = form_score(home_form)
        a_score = form_score(away_form)

        detail = f"홈 [{home_form[-5:]}] vs 원정 [{away_form[-5:]}]"
        return h_score, a_score, {
            "name": "최근 폼",
            "weight": self.WEIGHTS["recent_form"],
            "score": h_score,
            "detail": detail,
            "home_form": home_form[-5:] if home_form else "?",
            "away_form": away_form[-5:] if away_form else "?",
        }

    # ─── Factor 4: 상대전적 (15%) — placeholder ───
    def _calc_h2h_factor(self, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """H2H 상대전적 (API-Football H2H 데이터 사용)"""
        # 현재는 기본값 → API-Football의 collect_all에서 H2H 수집 후 연동
        return 50, 50, {
            "name": "상대전적",
            "weight": self.WEIGHTS["h2h"],
            "score": 50,
            "detail": "데이터 수집 중",
        }

    # ─── Factor 5: 홈/어웨이 (10%) ───
    def _calc_venue_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """홈/어웨이 성적 기반"""
        standings = self._standings_cache.get(league, [])
        home_record = None
        away_record = None

        for team in standings:
            name = team.team_name.lower() if isinstance(team, TeamStats) else team.get("team_name", "").lower()
            if home_team.lower() in name or name in home_team.lower():
                home_record = team
            if away_team.lower() in name or name in away_team.lower():
                away_record = team

        def venue_score(team_data, is_home: bool) -> float:
            if not team_data:
                return 55 if is_home else 45  # Default home advantage
            if isinstance(team_data, TeamStats):
                w = team_data.home_wins if is_home else team_data.away_wins
                d = team_data.home_draws if is_home else team_data.away_draws
                l = team_data.home_losses if is_home else team_data.away_losses
            else:
                prefix = "home_" if is_home else "away_"
                w = team_data.get(f"{prefix}wins", 0)
                d = team_data.get(f"{prefix}draws", 0)
                l = team_data.get(f"{prefix}losses", 0)
            total = w + d + l
            if total == 0:
                return 55 if is_home else 45
            return ((w * 3 + d) / (total * 3)) * 100

        h_score = venue_score(home_record, True)
        a_score = venue_score(away_record, False)

        detail = f"홈팀 홈성적 {h_score:.0f}점 / 원정팀 원정성적 {a_score:.0f}점"
        return h_score, a_score, {
            "name": "홈/어웨이",
            "weight": self.WEIGHTS["venue"],
            "score": h_score,
            "detail": detail,
        }

    # ─── Factor 6: 부상 영향 (10%) ───
    def _calc_injury_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """부상/결장 선수 수 기반 감점"""
        injuries = self._injuries_cache.get(league, [])
        home_injuries = []
        away_injuries = []

        for inj in injuries:
            team = inj.get("team_name", "") if isinstance(inj, dict) else inj.team_name
            player = inj.get("player_name", "") if isinstance(inj, dict) else inj.player_name
            if home_team.lower() in team.lower():
                home_injuries.append(player)
            elif away_team.lower() in team.lower():
                away_injuries.append(player)

        # 부상자가 많으면 감점 (1명당 -5점, 최대 -25)
        h_penalty = min(len(home_injuries) * 5, 25)
        a_penalty = min(len(away_injuries) * 5, 25)

        h_score = 50 - h_penalty + a_penalty  # 상대방 부상이 많으면 이득
        a_score = 50 - a_penalty + h_penalty

        detail = f"홈 부상 {len(home_injuries)}명 / 원정 부상 {len(away_injuries)}명"
        return max(h_score, 10), max(a_score, 10), {
            "name": "부상/결장",
            "weight": self.WEIGHTS["injuries"],
            "score": max(h_score, 10),
            "detail": detail,
            "home_injuries": home_injuries[:5],
            "away_injuries": away_injuries[:5],
        }

    # ─── Main Prediction ───
    def predict_match(self, odds: OddsItem) -> MatchPrediction:
        """경기 AI 예측 실행"""
        match_id = f"{odds.team_home}_{odds.team_away}"
        league = odds.league or ""

        # Calculate all factors
        imp_h, imp_d, imp_a, f_implied = self._calc_implied_prob(odds)
        rank_h, rank_a, f_rank = self._calc_rank_factor(league, odds.team_home, odds.team_away)
        form_h, form_a, f_form = self._calc_form_factor(league, odds.team_home, odds.team_away)
        h2h_h, h2h_a, f_h2h = self._calc_h2h_factor(odds.team_home, odds.team_away)
        venue_h, venue_a, f_venue = self._calc_venue_factor(league, odds.team_home, odds.team_away)
        inj_h, inj_a, f_inj = self._calc_injury_factor(league, odds.team_home, odds.team_away)

        # Weighted combination
        w = self.WEIGHTS
        home_score = (
            imp_h * w["implied_prob"] +
            rank_h * w["rank_diff"] +
            form_h * w["recent_form"] +
            h2h_h * w["h2h"] +
            venue_h * w["venue"] +
            inj_h * w["injuries"]
        )
        away_score = (
            imp_a * w["implied_prob"] +
            rank_a * w["rank_diff"] +
            form_a * w["recent_form"] +
            h2h_a * w["h2h"] +
            venue_a * w["venue"] +
            inj_a * w["injuries"]
        )
        draw_score = imp_d * w["implied_prob"] + 50 * (1 - w["implied_prob"])

        # Normalize to probabilities
        total = home_score + draw_score + away_score
        if total <= 0:
            total = 100

        home_prob = (home_score / total) * 100
        draw_prob = (draw_score / total) * 100
        away_prob = (away_score / total) * 100

        # Determine recommendation
        if home_prob > away_prob and home_prob > draw_prob:
            recommendation = "HOME"
            confidence = home_prob
        elif away_prob > home_prob and away_prob > draw_prob:
            recommendation = "AWAY"
            confidence = away_prob
        else:
            recommendation = "DRAW"
            confidence = draw_prob

        # Set factor scores for UI display
        f_implied["score"] = round(imp_h)
        factors = [f_implied, f_rank, f_form, f_h2h, f_venue, f_inj]

        # Check for API-Football external prediction
        api_pred = None
        api_pred_pct = None
        for p in self._predictions_cache:
            if (odds.team_home.lower() in p.get("home_team", "").lower() or
                p.get("home_team", "").lower() in odds.team_home.lower()):
                api_pred = p.get("winner", "")
                pct = p.get("percent", {})
                api_pred_pct = {
                    "home": int(pct.get("home", "0").replace("%", "") or 0),
                    "draw": int(pct.get("draw", "0").replace("%", "") or 0),
                    "away": int(pct.get("away", "0").replace("%", "") or 0),
                }
                break

        return MatchPrediction(
            match_id=match_id,
            team_home=odds.team_home,
            team_away=odds.team_away,
            team_home_ko=odds.team_home_ko,
            team_away_ko=odds.team_away_ko,
            league=league,
            sport=odds.sport or "Soccer",
            match_time=odds.match_time,
            confidence=round(confidence, 1),
            recommendation=recommendation,
            home_win_prob=round(home_prob, 1),
            draw_prob=round(draw_prob, 1),
            away_win_prob=round(away_prob, 1),
            factors=factors,
            home_rank=f_rank.get("home_rank", 0),
            away_rank=f_rank.get("away_rank", 0),
            home_form=f_form.get("home_form", ""),
            away_form=f_form.get("away_form", ""),
            h2h_summary=f_h2h.get("detail", ""),
            injuries_home=f_inj.get("home_injuries", []),
            injuries_away=f_inj.get("away_injuries", []),
            api_prediction=api_pred,
            api_prediction_pct=api_pred_pct,
        )

    def predict_all(self, odds_list: List[OddsItem]) -> List[MatchPrediction]:
        """전체 경기 예측 일괄 실행"""
        predictions = []
        for odds in odds_list:
            try:
                pred = self.predict_match(odds)
                predictions.append(pred)
            except Exception as e:
                logger.error(f"Prediction error for {odds.team_home} vs {odds.team_away}: {e}")
        
        # Sort by confidence (highest first)
        predictions.sort(key=lambda p: p.confidence, reverse=True)
        logger.info(f"🧠 AI predicted {len(predictions)} matches")
        return predictions
