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

    # Factor weights (합계 = 1.0) — 7-Factor v2
    WEIGHTS = {
        "implied_prob": 0.22,      # 배당률 기반 내재 확률
        "rank_diff": 0.18,        # 리그 순위 차이
        "recent_form": 0.18,      # 최근 5경기 폼
        "h2h": 0.13,              # 상대전적
        "venue": 0.09,            # 홈/어웨이 성적 (리그별 보정)
        "injuries": 0.10,         # 부상/결장 영향
        "api_prediction": 0.10,   # API-Football 외부 AI 예측
    }

    # 리그별 홈 어드밴티지 계수 (글로벌 평균 대비 보정)
    # 값이 높을수록 홈팀에 유리한 리그
    LEAGUE_HOME_ADV = {
        # 유럽 빅 5
        "soccer_epl": 1.05,
        "soccer_spain_la_liga": 1.12,
        "soccer_germany_bundesliga": 1.08,
        "soccer_italy_serie_a": 1.10,
        "soccer_france_ligue_one": 1.06,
        # 유럽 기타
        "soccer_turkey_super_lig": 1.25,        # 터키 홈 매우 강함
        "soccer_greece_super_league": 1.20,
        "soccer_serbia_superliga": 1.18,
        "soccer_portugal_liga": 1.10,
        "soccer_belgium_pro_league": 1.05,
        "soccer_scotland_premiership": 1.08,
        "soccer_netherlands_eredivisie": 1.04,
        "soccer_switzerland_super_league": 1.06,
        "soccer_austria_bundesliga": 1.07,
        "soccer_denmark_superliga": 1.05,
        "soccer_norway_eliteserien": 1.04,
        "soccer_sweden_allsvenskan": 1.03,
        "soccer_czech_first_league": 1.10,
        "soccer_poland_ekstraklasa": 1.12,
        "soccer_croatia_hnl": 1.10,
        # 대회 (중립/약한 홈)
        "soccer_uefa_champs_league": 1.02,
        "soccer_uefa_europa_league": 1.02,
        # 아시아
        "soccer_korea_kleague": 1.06,
        "soccer_japan_jleague": 1.02,            # 일본 홈 약함
        "soccer_china_super_league": 1.15,
        "soccer_australia_aleague": 1.03,
        "soccer_saudi_pro_league": 1.18,
        "soccer_india_super_league": 1.12,
        # 아메리카
        "soccer_usa_mls": 1.08,
        "soccer_brazil_serie_a": 1.15,
        "soccer_mexico_liga_mx": 1.20,           # 멕시코 고도 원정 불리
        "soccer_argentina_liga": 1.18,
        # 아프리카
        "soccer_egypt_premier_league": 1.22,
    }

    def __init__(self):
        self._standings_cache: Dict[str, List[TeamStats]] = {}
        self._injuries_cache: Dict[str, List] = {}
        self._predictions_cache: List[Dict] = []
        self._h2h_cache: Dict[str, Dict] = {}  # H2H 상대전적 캐시

    def update_data(self,
                     standings: Dict[str, List[TeamStats]] = None,
                     injuries: Dict[str, List] = None,
                     api_predictions: List[Dict] = None,
                     h2h: Dict[str, Dict] = None):
        """외부 데이터 업데이트"""
        if standings:
            self._standings_cache = standings
        if injuries:
            self._injuries_cache = injuries
        if api_predictions:
            self._predictions_cache = api_predictions
        if h2h:
            self._h2h_cache.update(h2h)

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

    # ─── Factor 3: 최근 폼 + 모멘텀 (18%) ───
    def _calc_form_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """최근 5경기 폼 + 모멘텀(상승세/하락세) 분석"""
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
            recent = form_str[-5:]
            w = recent.count("W")
            d = recent.count("D")
            l = recent.count("L")
            total = w + d + l
            if total == 0:
                return 50
            return ((w * 3 + d * 1) / (total * 3)) * 100

        def calc_momentum(form_str: str) -> float:
            """최근 3경기 vs 이전 5경기 비교 → 상승세/하락세"""
            if not form_str or len(form_str) < 4:
                return 0.0
            recent3 = form_str[-3:]
            older = form_str[-8:-3] if len(form_str) >= 8 else form_str[:-3]
            if not older:
                return 0.0
            def mini_score(s):
                t = len(s)
                if t == 0: return 50
                return ((s.count("W") * 3 + s.count("D")) / (t * 3)) * 100
            return mini_score(recent3) - mini_score(older)

        h_score = form_score(home_form)
        a_score = form_score(away_form)

        # 모멘텀 보정: 상승세면 +5~15, 하락세면 -5~15
        h_momentum = calc_momentum(home_form)
        a_momentum = calc_momentum(away_form)
        h_score += h_momentum * 0.15  # 모멘텀의 15% 반영
        a_score += a_momentum * 0.15

        h_score = max(10, min(95, h_score))
        a_score = max(10, min(95, a_score))

        h_trend = "↑" if h_momentum > 5 else ("↓" if h_momentum < -5 else "→")
        a_trend = "↑" if a_momentum > 5 else ("↓" if a_momentum < -5 else "→")

        detail = f"홈 [{home_form[-5:]}]{h_trend} vs 원정 [{away_form[-5:]}]{a_trend}"
        return h_score, a_score, {
            "name": "최근 폼",
            "weight": self.WEIGHTS["recent_form"],
            "score": round(h_score, 1),
            "detail": detail,
            "home_form": home_form[-5:] if home_form else "?",
            "away_form": away_form[-5:] if away_form else "?",
            "home_momentum": round(h_momentum, 1),
            "away_momentum": round(a_momentum, 1),
        }

    # ─── Factor 4: 상대전적 + 최근성 가중 (13%) ───
    def _calc_h2h_factor(self, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """H2H 상대전적 — Recency Decay 적용 (최근 3경기 ×1.5 가중)"""
        h2h_data = None
        h_wins, a_wins, draws_count = 0, 0, 0
        for key, data in self._h2h_cache.items():
            h_name = data.get("home_team", "").lower()
            a_name = data.get("away_team", "").lower()
            if ((home_team.lower() in h_name or h_name in home_team.lower()) and
                (away_team.lower() in a_name or a_name in away_team.lower())):
                h2h_data = data
                h_wins = data.get("team_a_wins", 0)
                a_wins = data.get("team_b_wins", 0)
                draws_count = data.get("draws", 0)
                break
            if ((home_team.lower() in a_name or a_name in home_team.lower()) and
                (away_team.lower() in h_name or h_name in away_team.lower())):
                h2h_data = data
                h_wins = data.get("team_b_wins", 0)
                a_wins = data.get("team_a_wins", 0)
                draws_count = data.get("draws", 0)
                break

        if not h2h_data or h2h_data.get("total_matches", 0) == 0:
            return 50, 50, {
                "name": "상대전적",
                "weight": self.WEIGHTS["h2h"],
                "score": 50,
                "detail": "상대전적 데이터 없음",
            }

        total = h2h_data["total_matches"]

        # Recency Decay: 최근 3경기에 ×1.5 가중
        recent = h2h_data.get("recent_results", [])
        recent_h_wins, recent_a_wins, recent_draws = 0, 0, 0
        recency_bonus_h, recency_bonus_a = 0, 0

        for i, r in enumerate(reversed(recent[-5:])):
            score_str = r.get("score", "")
            h_team_in_result = r.get("home", "").lower()
            try:
                parts = score_str.split("-")
                if len(parts) == 2:
                    g1, g2 = int(parts[0].strip()), int(parts[1].strip())
                    weight = 1.5 if i < 3 else 0.7  # 최근 3경기 ×1.5, 오래된 경기 ×0.7
                    if g1 > g2:
                        # home won in that h2h match
                        if home_team.lower() in h_team_in_result:
                            recency_bonus_h += weight
                        else:
                            recency_bonus_a += weight
                    elif g1 < g2:
                        if home_team.lower() in h_team_in_result:
                            recency_bonus_a += weight
                        else:
                            recency_bonus_h += weight
                    else:
                        recency_bonus_h += weight * 0.3
                        recency_bonus_a += weight * 0.3
            except (ValueError, IndexError):
                continue

        # 기본 승률 + recency bonus
        if total > 0:
            h_rate = ((h_wins * 3 + draws_count) / (total * 3)) * 100
            a_rate = ((a_wins * 3 + draws_count) / (total * 3)) * 100
        else:
            h_rate, a_rate = 50, 50

        # Recency bonus 적용 (0~15점 범위)
        total_recency = recency_bonus_h + recency_bonus_a
        if total_recency > 0:
            h_rate += (recency_bonus_h / total_recency) * 15 - 7.5
            a_rate += (recency_bonus_a / total_recency) * 15 - 7.5

        recent_str = ", ".join([r.get('score', '?') for r in recent[-3:]]) if recent else "없음"

        detail = f"{total}경기: {h_wins}승 {draws_count}무 {a_wins}패 | 최근: {recent_str}"
        return max(h_rate, 10), max(a_rate, 10), {
            "name": "상대전적",
            "weight": self.WEIGHTS["h2h"],
            "score": round(h_rate, 1),
            "detail": detail,
            "total_matches": total,
            "home_wins": h_wins,
            "away_wins": a_wins,
            "draws": draws_count,
            "recency_home": round(recency_bonus_h, 1),
            "recency_away": round(recency_bonus_a, 1),
        }

    # ─── Factor 5: 홈/어웨이 (9%) — 리그별 홈어드밴티지 보정 ───
    def _calc_venue_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """홈/어웨이 성적 기반 + 리그별 홈 어드밴티지 보정"""
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
                return 55 if is_home else 45
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

        # 리그별 홈 어드밴티지 계수 적용
        home_adv = self.LEAGUE_HOME_ADV.get(league, 1.05)
        h_score *= home_adv
        a_score /= home_adv  # 원정팀은 역보정

        detail = f"홈성적 {h_score:.0f}점 / 원정성적 {a_score:.0f}점 (홈계수 ×{home_adv})"
        return min(h_score, 95), max(a_score, 5), {
            "name": "홈/어웨이",
            "weight": self.WEIGHTS["venue"],
            "score": round(min(h_score, 95)),
            "detail": detail,
            "league_home_advantage": home_adv,
        }

    # ─── Factor 7: API-Football 외부 AI 예측 (10%) ───
    def _calc_api_prediction_factor(self, odds: OddsItem) -> Tuple[float, float, float, Dict]:
        """API-Football 외부 AI 예측 결과를 7번째 Factor로 합성"""
        for p in self._predictions_cache:
            h_name = p.get("home_team", "").lower()
            if (odds.team_home.lower() in h_name or h_name in odds.team_home.lower()):
                pct = p.get("percent", {})
                try:
                    api_h = int(str(pct.get("home", "33")).replace("%", "") or 33)
                    api_d = int(str(pct.get("draw", "33")).replace("%", "") or 33)
                    api_a = int(str(pct.get("away", "33")).replace("%", "") or 33)
                except (ValueError, TypeError):
                    api_h, api_d, api_a = 33, 33, 33

                detail = f"API-Football AI: 홈 {api_h}% / 무 {api_d}% / 원정 {api_a}%"
                return float(api_h), float(api_d), float(api_a), {
                    "name": "외부 AI 예측",
                    "weight": self.WEIGHTS["api_prediction"],
                    "score": max(api_h, api_d, api_a),
                    "detail": detail,
                }

        # 외부 예측 없으면 중립값
        return 33.3, 33.3, 33.3, {
            "name": "외부 AI 예측",
            "weight": self.WEIGHTS["api_prediction"],
            "score": 33,
            "detail": "API-Football 예측 없음 (중립값)",
        }

    # ─── Factor 6: 부상 영향 — 포지션 가중 (10%) ───
    POSITION_WEIGHTS = {
        "goalkeeper": 15, "gk": 15,
        "forward": 10, "fw": 10, "attacker": 10, "striker": 10,
        "midfielder": 8, "mf": 8, "mid": 8,
        "defender": 5, "df": 5, "cb": 5, "lb": 5, "rb": 5,
    }

    def _calc_injury_factor(self, league: str, home_team: str, away_team: str) -> Tuple[float, float, Dict]:
        """부상/결장 — 포지션별 가중 감점 (GK -15 / FW -10 / MF -8 / DF -5)"""
        injuries = self._injuries_cache.get(league, [])
        home_injuries = []
        away_injuries = []
        h_quality_penalty = 0
        a_quality_penalty = 0

        for inj in injuries:
            team = inj.get("team_name", "") if isinstance(inj, dict) else inj.team_name
            player = inj.get("player_name", "") if isinstance(inj, dict) else inj.player_name
            position = (inj.get("position", "") if isinstance(inj, dict) else getattr(inj, "position", "")).lower()

            # 포지션별 감점 계산
            penalty = 5  # 기본 감점
            for pos_key, weight in self.POSITION_WEIGHTS.items():
                if pos_key in position:
                    penalty = weight
                    break

            if home_team.lower() in team.lower():
                home_injuries.append(f"{player}({position[:2].upper()})")
                h_quality_penalty += penalty
            elif away_team.lower() in team.lower():
                away_injuries.append(f"{player}({position[:2].upper()})")
                a_quality_penalty += penalty

        # 품질 감점 적용 (최대 -40)
        h_quality_penalty = min(h_quality_penalty, 40)
        a_quality_penalty = min(a_quality_penalty, 40)

        h_score = 50 - h_quality_penalty + a_quality_penalty
        a_score = 50 - a_quality_penalty + h_quality_penalty

        detail = f"홈 부상 {len(home_injuries)}명(-{h_quality_penalty}점) / 원정 {len(away_injuries)}명(-{a_quality_penalty}점)"
        return max(h_score, 10), max(a_score, 10), {
            "name": "부상/결장",
            "weight": self.WEIGHTS["injuries"],
            "score": max(h_score, 10),
            "detail": detail,
            "home_injuries": home_injuries[:5],
            "away_injuries": away_injuries[:5],
            "home_quality_penalty": h_quality_penalty,
            "away_quality_penalty": a_quality_penalty,
        }

    # ─── Main Prediction ───
    def predict_match(self, odds: OddsItem) -> MatchPrediction:
        """경기 AI 예측 실행 — 7-Factor v2"""
        match_id = f"{odds.team_home}_{odds.team_away}"
        league = odds.league or ""

        # Calculate all 7 factors
        imp_h, imp_d, imp_a, f_implied = self._calc_implied_prob(odds)
        rank_h, rank_a, f_rank = self._calc_rank_factor(league, odds.team_home, odds.team_away)
        form_h, form_a, f_form = self._calc_form_factor(league, odds.team_home, odds.team_away)
        h2h_h, h2h_a, f_h2h = self._calc_h2h_factor(odds.team_home, odds.team_away)
        venue_h, venue_a, f_venue = self._calc_venue_factor(league, odds.team_home, odds.team_away)
        inj_h, inj_a, f_inj = self._calc_injury_factor(league, odds.team_home, odds.team_away)
        api_h, api_d, api_a, f_api = self._calc_api_prediction_factor(odds)

        # Weighted combination (7 factors)
        w = self.WEIGHTS
        home_score = (
            imp_h * w["implied_prob"] +
            rank_h * w["rank_diff"] +
            form_h * w["recent_form"] +
            h2h_h * w["h2h"] +
            venue_h * w["venue"] +
            inj_h * w["injuries"] +
            api_h * w["api_prediction"]
        )
        away_score = (
            imp_a * w["implied_prob"] +
            rank_a * w["rank_diff"] +
            form_a * w["recent_form"] +
            h2h_a * w["h2h"] +
            venue_a * w["venue"] +
            inj_a * w["injuries"] +
            api_a * w["api_prediction"]
        )
        draw_score = (
            imp_d * w["implied_prob"] +
            api_d * w["api_prediction"] +
            50 * (1 - w["implied_prob"] - w["api_prediction"])
        )

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
            raw_prob = home_prob
        elif away_prob > home_prob and away_prob > draw_prob:
            recommendation = "AWAY"
            raw_prob = away_prob
        else:
            recommendation = "DRAW"
            raw_prob = draw_prob

        # Convert raw probability → confidence (conviction scale)
        baseline = 33.33
        max_prob = 66.67
        confidence = ((raw_prob - baseline) / (max_prob - baseline)) * 50 + 50
        confidence = max(40, min(95, confidence))

        # Set factor scores for UI display
        f_implied["score"] = round(imp_h)
        factors = [f_implied, f_rank, f_form, f_h2h, f_venue, f_inj, f_api]

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
