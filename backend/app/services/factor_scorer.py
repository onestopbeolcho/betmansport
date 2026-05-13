import logging
import math

logger = logging.getLogger(__name__)

def calculate_factor_scores(match_data: dict) -> dict:
    """
    제공된 match_data를 기반으로 6-Factor 스코어를 산출합니다.
    각 팩터는 홈팀 관점에서 유리함을 기준으로 산출됩니다 (0~100점).
    결과는 홈팀 관점 총합 스코어와 각 팩터별 세부 점수(dict)를 반환합니다.
    """
    scores = {
        "power_rating": 50,
        "h2h_tactics": 50,
        "roster_impact": 50,
        "context_motivation": 50, # 아직 비정형 데이터 수집 전이므로 기본값
        "value_ev": 50
    }
    
    # 1. 기본 전력 (Power Rating) - 순위, 승점, 득실차, 최근 폼
    standings = match_data.get("standings", {})
    home_s = standings.get("home", {})
    away_s = standings.get("away", {})
    
    if home_s and away_s:
        try:
            # 순위 차이
            home_rank = int(home_s.get("rank", 10))
            away_rank = int(away_s.get("rank", 10))
            rank_diff = away_rank - home_rank # 양수면 홈팀 유리
            
            # 득실차 추정
            home_gf = int(home_s.get("goals_for", 0))
            home_ga = int(home_s.get("goals_against", 0))
            away_gf = int(away_s.get("goals_for", 0))
            away_ga = int(away_s.get("goals_against", 0))
            home_gd = home_gf - home_ga
            away_gd = away_gf - away_ga
            gd_diff = home_gd - away_gd
            
            # 폼 계산 (W, D, L 기반 - 약식)
            def calc_form_score(form_str):
                if not form_str: return 0
                points = sum([3 if c=='W' else 1 if c=='D' else 0 for c in form_str])
                return points

            home_form = calc_form_score(home_s.get("form", ""))
            away_form = calc_form_score(away_s.get("form", ""))
            form_diff = home_form - away_form
            
            # 종합 Power Score (기본 50 + 가감)
            power = 50 + (rank_diff * 1.5) + (gd_diff * 0.5) + (form_diff * 2)
            scores["power_rating"] = max(0, min(100, int(power)))
        except Exception as e:
            logger.warning(f"Power Rating 계산 오류: {e}")

    # 2. 상대 전적 (H2H)
    h2h = match_data.get("h2h", {})
    if h2h:
        try:
            total = int(h2h.get("total_matches", 0))
            if total > 0:
                h_wins = int(h2h.get("team_a_wins", 0))
                a_wins = int(h2h.get("team_b_wins", 0))
                win_rate = h_wins / total
                # 0.5면 50점, 1.0이면 100점
                scores["h2h_tactics"] = int(win_rate * 100)
        except Exception as e:
            logger.warning(f"H2H 계산 오류: {e}")

    # 3. 결장자 임팩트 (Roster Impact)
    injuries = match_data.get("injuries", {})
    if injuries:
        home_inj = len(injuries.get("home", []))
        away_inj = len(injuries.get("away", []))
        # 홈팀 부상자 1명당 -5점, 원정팀 부상자 1명당 +5점
        roster_score = 50 - (home_inj * 5) + (away_inj * 5)
        scores["roster_impact"] = max(0, min(100, roster_score))

    # 4. 배당 밸류 (Value EV)
    ho = float(match_data.get("home_odds", 0))
    ao = float(match_data.get("away_odds", 0))
    bh = float(match_data.get("betman_home_odds", 0) or 0)
    ba = float(match_data.get("betman_away_odds", 0) or 0)
    
    if ho > 1.0 and ao > 1.0 and bh > 0 and ba > 0:
        eff_home = (bh / ho) * 100
        eff_away = (ba / ao) * 100
        
        # 홈팀의 배당 밸류가 100% 이상이면 점수 상승, 낮으면 하락
        # 기준선: 효율성 90% (베트맨의 높은 환수율 마진 감안)
        val = 50 + (eff_home - 90) * 1.5 - (eff_away - 90) * 0.5
        scores["value_ev"] = max(0, min(100, int(val)))

    # 합산 계산 (가중치 적용)
    weights = {
        "power_rating": 0.35,
        "h2h_tactics": 0.20,
        "roster_impact": 0.20,
        "context_motivation": 0.10,
        "value_ev": 0.15
    }
    
    total_score = sum(scores[k] * weights[k] for k in weights)
    
    return {
        "total_score": round(total_score, 1), # 홈팀 유리도 (50 기준, 50 이상이면 홈 유리)
        "details": scores
    }
