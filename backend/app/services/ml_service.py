import os
import math
import lightgbm as lgb
import numpy as np
from typing import Dict, Any, List, Tuple
import logging
from app.services.espn_fast_service import espn_fast_service

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml_models")


def _devig_odds(home_odds: float, draw_odds: float, away_odds: float, is_two_way: bool = False) -> Tuple[float, float, float]:
    """
    북메이커 배당률에서 마진(Overround)을 제거하여 시장 순수 내재 확률(%) 산출.
    Power/Proportional de-vigging 적용.
    """
    if home_odds <= 1.0 or away_odds <= 1.0:
        if is_two_way:
            return 52.0, 0.0, 48.0
        return 42.0, 26.0, 32.0

    inv_h = 1.0 / home_odds
    inv_a = 1.0 / away_odds
    inv_d = (1.0 / draw_odds) if (not is_two_way and draw_odds and draw_odds > 1.0) else 0.0

    total_inv = inv_h + inv_d + inv_a
    if total_inv <= 0:
        return (52.0, 0.0, 48.0) if is_two_way else (42.0, 26.0, 32.0)

    # Favorite-Longshot Bias 보정을 위해 지수(k=1.05) 보정 적용
    k = 1.05
    p_h = (inv_h ** k)
    p_d = (inv_d ** k) if inv_d > 0 else 0.0
    p_a = (inv_a ** k)
    norm = p_h + p_d + p_a or 1.0

    return (
        round((p_h / norm) * 100.0, 2),
        round((p_d / norm) * 100.0, 2),
        round((p_a / norm) * 100.0, 2),
    )


def _dixon_coles_poisson_probs(lam_h: float, lam_a: float, rho: float = -0.08) -> Tuple[float, float, float]:
    """
    Dixon-Coles 보정이 적용된 포아송 기대득점 승/무/패 확률(%) 계산.
    저득점(0-0, 1-0, 0-1, 1-1) 상관관계 보정 포함.
    """
    lam_h = max(0.35, min(3.8, lam_h))
    lam_a = max(0.30, min(3.5, lam_a))

    p_h, p_d, p_a = 0.0, 0.0, 0.0
    for x in range(9):
        px = math.exp(-lam_h) * (lam_h ** x) / math.factorial(x)
        for y in range(9):
            py = math.exp(-lam_a) * (lam_a ** y) / math.factorial(y)
            # Dixon-Coles tau adjustment
            tau = 1.0
            if x == 0 and y == 0:
                tau = 1.0 - (lam_h * lam_a * rho)
            elif x == 0 and y == 1:
                tau = 1.0 + (lam_h * rho)
            elif x == 1 and y == 0:
                tau = 1.0 + (lam_a * rho)
            elif x == 1 and y == 1:
                tau = 1.0 - rho

            prob = max(0.0, px * py * tau)
            if x > y:
                p_h += prob
            elif x == y:
                p_d += prob
            else:
                p_a += prob

    total = p_h + p_d + p_a or 1.0
    return (
        round((p_h / total) * 100.0, 2),
        round((p_d / total) * 100.0, 2),
        round((p_a / total) * 100.0, 2),
    )


def _form_points_and_score(form_str: str) -> Tuple[int, int, float]:
    """최근 5경기 폼 문자열('DWWDD')에서 (승점, 경기수, 0~100 점수) 산출"""
    if not form_str:
        return 0, 0, 50.0
    chars = [c for c in form_str.upper() if c in ("W", "D", "L")][-5:]
    if not chars:
        return 0, 0, 50.0
    pts = sum(3 if c == "W" else (1 if c == "D" else 0) for c in chars)
    max_pts = len(chars) * 3
    # 최근 경기 가중치 반영
    weights = [0.8, 0.9, 1.0, 1.1, 1.2][-len(chars):]
    w_pts = sum((3 if c == "W" else (1 if c == "D" else 0)) * w for c, w in zip(chars, weights))
    w_max = sum(3 * w for w in weights)
    score = (w_pts / max(w_max, 1.0)) * 100.0
    return pts, len(chars), round(score, 1)


class MLInferenceService:
    """
    3-Pillar 하이브리드 퀀트 스포츠 승리 예측 엔진
    1) Pillar 1 (45%): 글로벌 북메이커 마진 제거 순수 내재 확률 (De-vigged Market Consensus)
    2) Pillar 2 (30%): Dixon-Coles 포아송 기대득실 모델 (축구) / 피타고리안 Log5 모델 (야구·농구·하키)
    3) Pillar 3 (25%): 실제 리그 순위·득실·최근 5경기 폼·배당 흐름 기반 7-Factor 정량 스코어링
    """
    def __init__(self):
        self.soccer_model = None
        self.baseball_model = None
        self._load_models()

    def _load_models(self):
        soccer_model_path = os.path.join(MODELS_DIR, "soccer_model_lgb.txt")
        baseball_model_path = os.path.join(MODELS_DIR, "baseball_model_lgb.txt")

        if os.path.exists(soccer_model_path):
            try:
                self.soccer_model = lgb.Booster(model_file=soccer_model_path)
                logger.info(f"Loaded Soccer Model from {soccer_model_path}")
            except Exception as e:
                logger.error(f"Failed to load soccer model: {e}")

        if os.path.exists(baseball_model_path):
            try:
                self.baseball_model = lgb.Booster(model_file=baseball_model_path)
                logger.info(f"Loaded Baseball Model from {baseball_model_path}")
            except Exception as e:
                logger.error(f"Failed to load baseball model: {e}")

    def predict_matches(self, sport: str, matches: List[Dict[str, Any]], stats_db: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        if not matches:
            return []
        stats_db = stats_db or {}
        preds = []
        for match in matches:
            try:
                pred = self._analyze_single_match(match, stats_db, default_sport=sport)
                if pred:
                    preds.append(pred)
            except Exception as e:
                logger.warning(f"Prediction failed for {match.get('team_home')} vs {match.get('team_away')}: {e}")
        return preds

    def _analyze_single_match(self, match: Dict[str, Any], stats_db: Dict[str, Any], default_sport: str = "Soccer") -> Dict[str, Any]:
        home_team = match.get("team_home") or match.get("home_team") or ""
        away_team = match.get("team_away") or match.get("away_team") or ""
        sport_raw = (match.get("sport") or default_sport or "Soccer").strip()
        is_soccer = sport_raw.lower() == "soccer"
        is_two_way = not is_soccer

        match_id = f"{home_team}_{away_team}"
        ctx = espn_fast_service.match_context_cache.get(match_id, {})

        h_odds = float(match.get("home_odds") or match.get("pin_home_odds") or ctx.get("home_odds") or 0.0)
        d_odds = float(match.get("draw_odds") or match.get("pin_draw_odds") or ctx.get("draw_odds") or 0.0)
        a_odds = float(match.get("away_odds") or match.get("pin_away_odds") or ctx.get("away_odds") or 0.0)

        if is_two_way:
            d_odds = 0.0

        # ── 1. 팀 통계 조회 (stats_db -> espn_fast_service.team_stats_cache -> match_context) ──
        h_stat = stats_db.get(home_team) or espn_fast_service.get_team_stat(home_team) or {}
        a_stat = stats_db.get(away_team) or espn_fast_service.get_team_stat(away_team) or {}

        h_rank = int(h_stat.get("rank", 0) or 0)
        a_rank = int(a_stat.get("rank", 0) or 0)
        total_teams = max(int(h_stat.get("total_teams", 20) or 20), int(a_stat.get("total_teams", 20) or 20), h_rank, a_rank, 16)

        h_w = int(h_stat.get("wins", ctx.get("home_wins", 0)) or 0)
        h_d = int(h_stat.get("draws", ctx.get("home_draws", 0)) or 0)
        h_l = int(h_stat.get("losses", ctx.get("home_losses", 0)) or 0)
        a_w = int(a_stat.get("wins", ctx.get("away_wins", 0)) or 0)
        a_d = int(a_stat.get("draws", ctx.get("away_draws", 0)) or 0)
        a_l = int(a_stat.get("losses", ctx.get("away_losses", 0)) or 0)

        h_gp = max(int(h_stat.get("played", h_w + h_d + h_l) or (h_w + h_d + h_l)), 0)
        a_gp = max(int(a_stat.get("played", a_w + a_d + a_l) or (a_w + a_d + a_l)), 0)

        h_pts = int(h_stat.get("points", h_w * 3 + h_d if is_soccer else h_w) or 0)
        a_pts = int(a_stat.get("points", a_w * 3 + a_d if is_soccer else a_w) or 0)
        h_gd = int(h_stat.get("goal_diff", 0) or 0)
        a_gd = int(a_stat.get("goal_diff", 0) or 0)

        h_form = (match.get("home_form") or ctx.get("home_form") or h_stat.get("form_str") or h_stat.get("form") or "").upper()
        a_form = (match.get("away_form") or ctx.get("away_form") or a_stat.get("form_str") or a_stat.get("form") or "").upper()

        # ── Pillar 1: 글로벌 배당 마진 제거 내재 확률 (Market Consensus, 가중치 45%) ──
        mkt_h, mkt_d, mkt_a = _devig_odds(h_odds, d_odds, a_odds, is_two_way=is_two_way)

        # ── Pillar 2: 기대득실 통계 모델 (Dixon-Coles Poisson / Pythagorean Log5, 가중치 30%) ──
        home_adv = float(ctx.get("home_adv", 1.07 if is_soccer else 1.05))
        if is_soccer:
            h_xg = float(h_stat.get("xg_per_match") or h_stat.get("avg_xG_for") or h_stat.get("avg_gf") or 1.38)
            h_xga = float(h_stat.get("xga_per_match") or h_stat.get("avg_xG_against") or h_stat.get("avg_ga") or 1.32)
            a_xg = float(a_stat.get("xg_per_match") or a_stat.get("avg_xG_for") or a_stat.get("avg_gf") or 1.32)
            a_xga = float(a_stat.get("xga_per_match") or a_stat.get("avg_xG_against") or a_stat.get("avg_ga") or 1.38)

            raw_lam_h = max(0.45, min(3.4, ((h_xg + a_xga) / 2.0) * home_adv))
            raw_lam_a = max(0.35, min(3.1, ((a_xg + h_xga) / 2.0) * (2.0 - home_adv)))

            # 배당 내재 확률과 기대득점의 일관성 보정 (유럽 대항전 리그 격차 및 팀 통계 부족 시 시장 기댓값 반영)
            if h_odds > 1.0 and a_odds > 1.0:
                mkt_ratio = max(0.12, min(8.0, mkt_h / max(mkt_a, 5.0)))
                mkt_lam_h = max(0.45, min(3.2, 1.38 * (mkt_ratio ** 0.38)))
                mkt_lam_a = max(0.35, min(3.0, 1.25 / (mkt_ratio ** 0.38)))
                if h_gp == 0 or a_gp == 0:
                    lam_h, lam_a = mkt_lam_h, mkt_lam_a
                else:
                    lam_h = round(raw_lam_h * 0.55 + mkt_lam_h * 0.45, 2)
                    lam_a = round(raw_lam_a * 0.55 + mkt_lam_a * 0.45, 2)
            else:
                lam_h, lam_a = raw_lam_h, raw_lam_a

            stat_h, stat_d, stat_a = _dixon_coles_poisson_probs(lam_h, lam_a)
        else:
            # MLB / NBA / NHL Log5 + 득실차 모델
            h_wp = (h_w + 2.0) / (max(h_w + h_l, 0) + 4.0)
            a_wp = (a_w + 2.0) / (max(a_w + a_l, 0) + 4.0)
            num = h_wp * (1.0 - a_wp) * home_adv
            den = num + (1.0 - h_wp) * a_wp
            raw_stat_h = max(18.0, min(82.0, (num / den if den > 0 else 0.52) * 100.0))
            if h_gp == 0 or a_gp == 0:
                stat_h = round(mkt_h, 2)
            else:
                stat_h = round(raw_stat_h * 0.65 + mkt_h * 0.35, 2)
            stat_d = 0.0
            stat_a = round(100.0 - stat_h, 2)
            lam_h = float(h_stat.get("avg_gf", 4.5 if sport_raw.lower() == "baseball" else 112.0 if sport_raw.lower() == "basketball" else 3.1))
            lam_a = float(a_stat.get("avg_gf", 4.2 if sport_raw.lower() == "baseball" else 110.0 if sport_raw.lower() == "basketball" else 2.9))

        # ── Pillar 3: 7-Factor 정량 스코어링 및 실제 근거 생성 (가중치 25%) ──
        # 각 Factor 점수는 0~100 (50=중립, >50 홈 우세, <50 원정 우세)

        # Factor 1: 전력 지수 (Power Rating - 순위/승률/득실차)
        if h_rank > 0 and a_rank > 0:
            rank_edge = ((a_rank - h_rank) / max(total_teams, 1)) * 42.0
            gd_edge = max(-15.0, min(15.0, (h_gd - a_gd) * (0.6 if is_soccer else 0.15)))
            f_power_score = int(round(max(12.0, min(92.0, 50.0 + rank_edge + gd_edge))))
            power_ev = f"리그 순위: 홈 {h_rank}위({h_w}승 {h_d}무 {h_l}패, 득실 {h_gd:+d}) vs 원정 {a_rank}위({a_w}승 {a_d}무 {a_l}패, 득실 {a_gd:+d})"
        elif h_gp > 0 or a_gp > 0:
            h_wr = (h_w + 0.5 * h_d) / max(h_gp, 1)
            a_wr = (a_w + 0.5 * a_d) / max(a_gp, 1)
            f_power_score = int(round(max(15.0, min(88.0, 50.0 + (h_wr - a_wr) * 55.0))))
            power_ev = f"시즌 성적: 홈 {h_w}승 {h_d}무 {h_l}패 vs 원정 {a_w}승 {a_d}무 {a_l}패"
        else:
            f_power_score = int(round(max(18.0, min(85.0, 50.0 + (mkt_h - mkt_a) * 0.45))))
            power_ev = f"클럽 전력 시드: 홈 승률 기대치 {mkt_h:.1f}% vs 원정 {mkt_a:.1f}%"

        # Factor 2: 최근 경기 흐름 (Form & Momentum - 최근 5경기)
        h_fpts, h_fcnt, h_fscore = _form_points_and_score(h_form)
        a_fpts, a_fcnt, a_fscore = _form_points_and_score(a_form)
        if h_fcnt > 0 and a_fcnt > 0:
            f_form_score = int(round(max(12.0, min(92.0, 50.0 + (h_fscore - a_fscore) * 0.48))))
            form_ev = f"최근 {h_fcnt}경기 흐름: 홈 [{h_form[-5:]}] ({h_fpts}점) vs 원정 [{a_form[-5:]}] ({a_fpts}점)"
        elif h_gp > 0 and a_gp > 0:
            h_wr = round((h_w / max(h_gp, 1)) * 100, 1)
            a_wr = round((a_w / max(a_gp, 1)) * 100, 1)
            f_form_score = int(round(max(15.0, min(88.0, 50.0 + (h_wr - a_wr) * 0.45))))
            form_ev = f"시즌 승률 흐름: 홈 승률 {h_wr}% ({h_w}승 {h_l}패) vs 원정 승률 {a_wr}% ({a_w}승 {a_l}패)"
        else:
            f_form_score = int(round(max(20.0, min(82.0, 50.0 + (stat_h - stat_a) * 0.4))))
            form_ev = f"최근 공수 페이스 지수: 홈 {stat_h:.1f}pt vs 원정 {stat_a:.1f}pt"

        # Factor 3: 배당 내재 확률 (Market Implied Probability)
        f_mkt_score = int(round(max(10.0, min(94.0, 50.0 + (mkt_h - mkt_a) * 0.55))))
        if is_soccer and d_odds > 1.0:
            mkt_ev = f"글로벌 배당 [{h_odds:.2f} / {d_odds:.2f} / {a_odds:.2f}] → 마진제거 순수 승률 홈 {mkt_h:.1f}% · 무 {mkt_d:.1f}% · 원정 {mkt_a:.1f}%"
        else:
            mkt_ev = f"글로벌 머니라인 [{h_odds:.2f} vs {a_odds:.2f}] → 마진제거 순수 승률 홈 {mkt_h:.1f}% · 원정 {mkt_a:.1f}%"

        # Factor 4: 기대득실 모델 (Poisson / Scoring Efficiency)
        f_xg_score = int(round(max(12.0, min(92.0, 50.0 + (stat_h - stat_a) * 0.52))))
        if is_soccer:
            xg_ev = f"기대득점(xG) 시뮬레이션: 홈 {lam_h:.2f}골 vs 원정 {lam_a:.2f}골 (포아송 홈승 {stat_h:.1f}% / 원정승 {stat_a:.1f}%)"
        else:
            xg_ev = f"경기당 평균 득점력: 홈 {lam_h:.1f}점 vs 원정 {lam_a:.1f}점 (Log5 기대승률 홈 {stat_h:.1f}%)"

        # Factor 5: 배당 흐름 및 핸디캡 (Line Movement & Spread)
        open_h = float(match.get("open_home_odds") or ctx.get("open_home_odds") or h_odds)
        open_a = float(match.get("open_away_odds") or ctx.get("open_away_odds") or a_odds)
        ou_line = match.get("over_under") or ctx.get("over_under")
        spread_str = match.get("spread_details") or ctx.get("spread_details") or ""

        line_shift = 0.0
        if open_h > 1.0 and h_odds > 1.0:
            # 홈 배당이 오프닝보다 떨어졌으면(+) 홈 쪽으로 스마트머니 유입
            line_shift = ((open_h - h_odds) / open_h) * 100.0
        f_line_score = int(round(max(20.0, min(85.0, 50.0 + line_shift * 1.5 + (mkt_h - mkt_a) * 0.25))))
        if abs(line_shift) >= 1.5:
            dir_ko = f"홈 배당 하락({open_h:.2f}→{h_odds:.2f}, 홈 강세 유입)" if line_shift > 0 else f"원정 배당 하락({open_a:.2f}→{a_odds:.2f}, 원정 강세 유입)"
        else:
            dir_ko = f"현재 배당 안정 유지 (홈 {h_odds:.2f} / 원정 {a_odds:.2f})"
        if ou_line:
            dir_ko += f" | 기준점 U/O {ou_line}"
        if spread_str:
            dir_ko += f" ({spread_str})"

        # Factor 6: 홈/원정 구장 지배력 (Venue Advantage)
        venue_bonus = (home_adv - 1.0) * 180.0
        f_venue_score = int(round(max(35.0, min(78.0, 50.0 + venue_bonus + (f_power_score - 50) * 0.2))))
        venue_ev = f"리그 홈 어드밴티지 계수 ×{home_adv:.2f} 반영 (홈 구장 기대승률 +{venue_bonus:.1f}%p 보정)"

        # Factor 7: 매치업 상성 및 일정 변수 (Matchup & Schedule Balance)
        f_matchup_score = int(round(max(20.0, min(85.0, (f_power_score * 0.4 + f_form_score * 0.35 + f_xg_score * 0.25)))))
        gap_desc = "홈팀 공수 밸런스 우위" if f_matchup_score >= 55 else ("원정팀 공수 밸런스 우위" if f_matchup_score <= 45 else "양팀 전력 백중세 접전 양상")
        matchup_ev = f"종합 전력·폼·기대득실 교차 검증: {gap_desc} (매치업 지수 {f_matchup_score}점)"

        # 7-Factor 종합 점수 (0~100, 50 중립)
        composite_factor_home = (
            f_power_score * 0.20
            + f_form_score * 0.15
            + f_mkt_score * 0.20
            + f_xg_score * 0.15
            + f_line_score * 0.10
            + f_venue_score * 0.10
            + f_matchup_score * 0.10
        )
        # Factor 점수를 승/무/패 확률로 변환
        if is_soccer:
            fac_d = max(16.0, min(33.0, 29.0 - abs(composite_factor_home - 50.0) * 0.35))
            rem = 100.0 - fac_d
            fac_h = rem * (composite_factor_home / 100.0)
            fac_a = rem - fac_h
        else:
            fac_d = 0.0
            fac_h = composite_factor_home
            fac_a = 100.0 - composite_factor_home

        # ── 3-Pillar 최종 앙상블 확률 산출 (Market 45% + Stat/Poisson 30% + 7-Factor 25%) ──
        raw_h = mkt_h * 0.45 + stat_h * 0.30 + fac_h * 0.25
        raw_d = (mkt_d * 0.45 + stat_d * 0.30 + fac_d * 0.25) if is_soccer else 0.0
        raw_a = mkt_a * 0.45 + stat_a * 0.30 + fac_a * 0.25

        # 기관 퀀트 캘리브레이션: 시장 내재확률 대비 과도한 왜곡 방지 (최대 상대편차 ±18%, 절대편차 ±8.5%p)
        def _clamp_edge(raw_p: float, mkt_p: float) -> float:
            if mkt_p <= 0:
                return 0.0
            max_delta = min(8.5, mkt_p * 0.18)
            return max(max(1.0, mkt_p - max_delta), min(95.0, mkt_p + max_delta, raw_p) if raw_p >= mkt_p else max(mkt_p - max_delta, raw_p))

        raw_h = _clamp_edge(raw_h, mkt_h)
        raw_d = _clamp_edge(raw_d, mkt_d) if is_soccer else 0.0
        raw_a = _clamp_edge(raw_a, mkt_a)

        total_p = raw_h + raw_d + raw_a or 100.0
        final_h = round((raw_h / total_p) * 100.0, 1)
        final_d = round((raw_d / total_p) * 100.0, 1) if is_soccer else 0.0
        final_a = round(100.0 - final_h - final_d, 1)

        # 추천 방향 결정
        best_prob = max(final_h, final_d, final_a)
        if not is_soccer:
            rec = "HOME" if final_h >= final_a else "AWAY"
            best_prob = final_h if rec == "HOME" else final_a
        else:
            if final_h >= final_a and final_h >= final_d:
                rec = "HOME"
                best_prob = final_h
            elif final_a >= final_h and final_a >= final_d:
                rec = "AWAY"
                best_prob = final_a
            else:
                rec = "DRAW"
                best_prob = final_d

        # ── 신뢰도(Confidence) 산출: 승률 우위폭 + 3대 모델(배당·통계·폼) 일치도 ──
        probs_sorted = sorted([final_h, final_d, final_a] if is_soccer else [final_h, final_a], reverse=True)
        prob_gap = probs_sorted[0] - probs_sorted[1]  # 1순위와 2순위 확률 격차

        # 3대 지표(배당, 통계, 폼) 일치 보너스
        consensus_count = 0
        if rec == "HOME":
            if mkt_h > mkt_a: consensus_count += 1
            if stat_h > stat_a: consensus_count += 1
            if f_form_score >= 52: consensus_count += 1
        elif rec == "AWAY":
            if mkt_a > mkt_h: consensus_count += 1
            if stat_a > stat_h: consensus_count += 1
            if f_form_score <= 48: consensus_count += 1
        else:
            if abs(mkt_h - mkt_a) < 10: consensus_count += 2

        # 3-Way(축구)는 55% 승률만 되어도 강한 정배(1.60배 수준)이므로 연속적 스케일 보정
        if is_soccer:
            raw_conf = 34.0 + best_prob * 0.58 + (prob_gap * 0.24) + (consensus_count * 2.8)
        else:
            raw_conf = 26.0 + best_prob * 0.64 + (prob_gap * 0.22) + (consensus_count * 2.5)

        confidence = round(max(51.5, min(95.8, raw_conf)), 1)

        # 프론트엔드에서는 우세팀 방향으로 점수가 높을수록 직관적이므로, 추천 방향 기준 표시 점수도 함께 정렬
        def _display_score(home_centered_score: int) -> int:
            if rec == "AWAY":
                return int(max(15, min(95, 100 - home_centered_score)))
            return int(max(15, min(95, home_centered_score)))

        factors = [
            {
                "name": "배당 내재 확률",
                "weight": 0.20,
                "score": _display_score(f_mkt_score),
                "detail": mkt_ev,
                "evidence": mkt_ev,
            },
            {
                "name": "전력 및 순위 지수",
                "weight": 0.20,
                "score": _display_score(f_power_score),
                "detail": power_ev,
                "evidence": power_ev,
            },
            {
                "name": "기대득실(xG/포아송)",
                "weight": 0.15,
                "score": _display_score(f_xg_score),
                "detail": xg_ev,
                "evidence": xg_ev,
            },
            {
                "name": "최근 경기 흐름",
                "weight": 0.15,
                "score": _display_score(f_form_score),
                "detail": form_ev,
                "evidence": form_ev,
            },
            {
                "name": "배당 흐름·핸디캡",
                "weight": 0.10,
                "score": _display_score(f_line_score),
                "detail": dir_ko,
                "evidence": dir_ko,
            },
            {
                "name": "홈/원정 구장 이점",
                "weight": 0.10,
                "score": _display_score(f_venue_score),
                "detail": venue_ev,
                "evidence": venue_ev,
            },
            {
                "name": "종합 매치업 밸런스",
                "weight": 0.10,
                "score": _display_score(f_matchup_score),
                "detail": matchup_ev,
                "evidence": matchup_ev,
            },
        ]

        return {
            "match_id": match_id,
            "team_home": home_team,
            "team_away": away_team,
            "team_home_ko": match.get("team_home_ko") or home_team,
            "team_away_ko": match.get("team_away_ko") or away_team,
            "league": match.get("league", ""),
            "sport": sport_raw,
            "match_time": match.get("match_time"),
            "confidence": confidence,
            "recommendation": rec,
            "home_win_prob": final_h,
            "draw_prob": final_d,
            "away_win_prob": final_a,
            "home_rank": h_rank,
            "away_rank": a_rank,
            "home_form": h_form[-5:] if h_form else "",
            "away_form": a_form[-5:] if a_form else "",
            "factors": factors,
            "engine": "Hybrid Quant v3 (Market + Poisson + 7-Factor)",
        }


ml_inference_service = MLInferenceService()
