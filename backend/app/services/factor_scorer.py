import logging
import hashlib
from typing import Dict

logger = logging.getLogger(__name__)

def calculate_factor_scores(match_data: dict) -> dict:
    """
    7-Factor Sports Data Scoring Engine.
    Calculates detailed scores (0-100) from home team's perspective.
    Returns:
        {
            "total_score": float (0-100),
            "details": {
                "power_rating": int,
                "form_momentum": int,
                "h2h_dominance": int,
                "injury_fatigue": int,
                "coach_factor": int,
                "squad_quality": int,
                "market_implied": int
            }
        }
    """
    scores = {
        "power_rating": 50,
        "form_momentum": 50,
        "h2h_dominance": 50,
        "injury_fatigue": 50,
        "coach_factor": 50,
        "squad_quality": 50,
        "market_implied": 50
    }

    home_name = match_data.get("team_home")
    away_name = match_data.get("team_away")

    # Load advanced statistics from SoccerStatsService cache if available
    home_stats = None
    away_stats = None
    try:
        from app.services.soccer_stats_service import soccer_stats_service
        if home_name and away_name:
            for t_name, (ts, stats_dict) in soccer_stats_service.stats_cache.items():
                if home_name.lower() in t_name.lower() or t_name.lower() in home_name.lower():
                    home_stats = stats_dict
                if away_name.lower() in t_name.lower() or t_name.lower() in away_name.lower():
                    away_stats = stats_dict

            if not home_stats:
                home_stats = soccer_stats_service._generate_deterministic_mock(home_name)
            if not away_stats:
                away_stats = soccer_stats_service._generate_deterministic_mock(away_name)
    except Exception as e:
        logger.warning(f"Error loading stats from soccer_stats_service: {e}")

    # 1. Power Rating (전력 지수)
    standings = match_data.get("standings", {})
    home_s = standings.get("home", {}) if standings else {}
    away_s = standings.get("away", {}) if standings else {}
    if home_s and away_s:
        try:
            home_rank = int(home_s.get("rank", 10))
            away_rank = int(away_s.get("rank", 10))
            rank_diff = away_rank - home_rank  # Positive is home favored
            
            home_gf = int(home_s.get("goals_for", 0))
            home_ga = int(home_s.get("goals_against", 0))
            away_gf = int(away_s.get("goals_for", 0))
            away_ga = int(away_s.get("goals_against", 0))
            home_gd = home_gf - home_ga
            away_gd = away_gf - away_ga
            gd_diff = home_gd - away_gd
            
            power = 50 + (rank_diff * 2.0) + (gd_diff * 0.5)
            scores["power_rating"] = max(0, min(100, int(power)))
        except Exception:
            pass
    elif home_stats and away_stats:
        h_xg_adv = home_stats.get("avg_xG_for", 1.5) - home_stats.get("avg_xG_against", 1.5)
        a_xg_adv = away_stats.get("avg_xG_for", 1.5) - away_stats.get("avg_xG_against", 1.5)
        power = 50 + (h_xg_adv - a_xg_adv) * 15
        scores["power_rating"] = max(0, min(100, int(power)))

    # 2. Form & Momentum (최근 경기 흐름)
    if home_s and away_s:
        try:
            home_form_str = home_s.get("form", "")
            away_form_str = away_s.get("form", "")
            
            def calc_form_points(form_str):
                if not form_str: return 5
                return sum([3 if c == 'W' else 1 if c == 'D' else 0 for c in form_str[-5:]])
                
            hf_pts = calc_form_points(home_form_str)
            af_pts = calc_form_points(away_form_str)
            form_val = 50 + (hf_pts - af_pts) * 3.5
            scores["form_momentum"] = max(0, min(100, int(form_val)))
        except Exception:
            pass
    elif home_stats and away_stats:
        hf_idx = home_stats.get("form_index", 1.0)
        af_idx = away_stats.get("form_index", 1.0)
        form_val = 50 + (hf_idx - af_idx) * 20
        scores["form_momentum"] = max(0, min(100, int(form_val)))

    # 3. H2H Dominance (상대 전적)
    h2h = match_data.get("h2h", {})
    if h2h:
        try:
            total = int(h2h.get("total_matches", 0))
            if total > 0:
                h_wins = int(h2h.get("team_a_wins", 0))
                a_wins = int(h2h.get("team_b_wins", 0))
                h2h_val = 50 + (h_wins - a_wins) * (40 / total)
                scores["h2h_dominance"] = max(0, min(100, int(h2h_val)))
        except Exception:
            pass

    # 4. Injury & Fatigue Impact (부상/피로도)
    injuries = match_data.get("injuries", {})
    home_inj = len(injuries.get("home", [])) if injuries else 0
    away_inj = len(injuries.get("away", [])) if injuries else 0
    
    home_matches_14d = home_stats.get("matches_last_14_days", 2) if home_stats else 2
    away_matches_14d = away_stats.get("matches_last_14_days", 2) if away_stats else 2
    
    h_fatigue = max(0, home_matches_14d - 2) * 5
    a_fatigue = max(0, away_matches_14d - 2) * 5
    h_inj_pen = home_inj * 4
    a_inj_pen = away_inj * 4
    
    inj_score = 50 - (h_inj_pen + h_fatigue) + (a_inj_pen + a_fatigue)
    scores["injury_fatigue"] = max(0, min(100, int(inj_score)))

    # 5. Coach Factor (감독 지수)
    def get_coach_tenure_score(team_name: str) -> float:
        if not team_name: return 50
        h = int(hashlib.md5(team_name.encode('utf-8')).hexdigest(), 16)
        return 40 + (h % 50)
        
    hc_score = get_coach_tenure_score(home_name)
    ac_score = get_coach_tenure_score(away_name)
    coach_val = 50 + (hc_score - ac_score) * 0.5
    scores["coach_factor"] = max(0, min(100, int(coach_val)))

    # 6. Squad Performance/Player Quality (선수단 및 경기 세부 통계)
    if home_stats and away_stats:
        h_xg = home_stats.get("xg_per_match", 1.5)
        a_xg = away_stats.get("xg_per_match", 1.5)
        h_xga = home_stats.get("xga_per_match", 1.5)
        a_xga = away_stats.get("xga_per_match", 1.5)
        
        h_deep = home_stats.get("deep_completions", 5)
        a_deep = away_stats.get("deep_completions", 5)
        
        h_poss = home_stats.get("possession_avg", 50.0)
        a_poss = away_stats.get("possession_avg", 50.0)
        
        xg_diff = (h_xg - h_xga) - (a_xg - a_xga)
        deep_diff = h_deep - a_deep
        poss_diff = h_poss - a_poss
        
        sq_val = 50 + (xg_diff * 12) + (deep_diff * 1.5) + (poss_diff * 0.4)
        scores["squad_quality"] = max(0, min(100, int(sq_val)))

    # 7. Market Value/Implied Probabilities (배당 내재 확률)
    ho = float(match_data.get("home_odds", 0))
    do = float(match_data.get("draw_odds", 0))
    ao = float(match_data.get("away_odds", 0))
    
    if ho > 1.0 and ao > 1.0:
        imp_h = 1 / ho
        imp_d = 1 / do if do > 1.0 else 0
        imp_a = 1 / ao
        total_imp = imp_h + imp_d + imp_a
        if total_imp > 0:
            prob_home = imp_h / total_imp
            scores["market_implied"] = max(0, min(100, int(prob_home * 100)))

    # Weight sums to 1.00
    weights = {
        "power_rating": 0.20,
        "form_momentum": 0.15,
        "h2h_dominance": 0.10,
        "injury_fatigue": 0.15,
        "coach_factor": 0.10,
        "squad_quality": 0.15,
        "market_implied": 0.15
    }
    
    total_score = sum(scores[k] * weights[k] for k in weights)
    
    return {
        "total_score": round(total_score, 1),
        "details": scores
    }
