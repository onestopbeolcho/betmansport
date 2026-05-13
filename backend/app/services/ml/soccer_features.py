import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, List

def calculate_soccer_features(match_data: Dict[str, Any], team_stats: Dict[str, Any]) -> Dict[str, float]:
    """
    유럽 4대 리그 축구의 승무패 분석을 위한 핵심 Feature 엔지니어링
    """
    home_team = match_data.get("team_home", match_data.get("home_team", ""))
    away_team = match_data.get("team_away", match_data.get("away_team", ""))
    
    # 1. xG (기대 득점) 기반 지수
    home_stats = team_stats.get(home_team, {})
    away_stats = team_stats.get(away_team, {})
    
    # Understat 고차원 지표 우선 활용
    home_xG_for = home_stats.get("xg_per_match", home_stats.get("avg_xG_for", 1.0))
    home_xG_against = home_stats.get("xga_per_match", home_stats.get("avg_xG_against", 1.5))
    away_xG_for = away_stats.get("xg_per_match", away_stats.get("avg_xG_for", 1.0))
    away_xG_against = away_stats.get("xga_per_match", away_stats.get("avg_xG_against", 1.5))
    
    # 경기 지배력 지수
    home_dominance_index = home_xG_for - home_xG_against
    away_dominance_index = away_xG_for - away_xG_against
    
    # 2. 피로도 패턴
    home_recent_matches_14d = home_stats.get("matches_last_14_days", 2)
    away_recent_matches_14d = away_stats.get("matches_last_14_days", 2)
    
    home_fatigue = min(home_recent_matches_14d * 0.15, 1.0)
    away_fatigue = min(away_recent_matches_14d * 0.15, 1.0)
    
    # 3. Form & Momentum
    home_form = home_stats.get("form_index", 1.0)
    away_form = away_stats.get("form_index", 1.0)
    
    # 4. 압박 및 위험지역 진입 (PPDA & Deep)
    home_ppda = home_stats.get("ppda_avg", 10.0)
    away_ppda = away_stats.get("ppda_avg", 10.0)
    home_deep = home_stats.get("deep_completions", 5)
    away_deep = away_stats.get("deep_completions", 5)
    
    # 5. 결정력 효율 (xG Overperformance)
    home_xg_eff = home_stats.get("xg_overperformance", 0.0)
    away_xg_eff = away_stats.get("xg_overperformance", 0.0)
    
    return {
        "home_dominance_idx": home_dominance_index,
        "away_dominance_idx": away_dominance_index,
        "fatigue_diff": home_fatigue - away_fatigue,
        "home_xG_advantage": home_xG_for - away_xG_against,
        "away_xG_advantage": away_xG_for - home_xG_against,
        "form_diff": home_form - away_form, 
        "ppda_diff": away_ppda - home_ppda, # PPDA는 낮을수록 강한 압박 (원정 - 홈 이 크면 홈팀 압박이 더 강함)
        "deep_diff": home_deep - away_deep,
        "xg_eff_diff": home_xg_eff - away_xg_eff,
        "possession_diff": home_stats.get("possession_avg", 50.0) - away_stats.get("possession_avg", 50.0),
        "injury_impact_diff": home_stats.get("injury_impact_score", 0.0) - away_stats.get("injury_impact_score", 0.0),
        "home_implied_prob": match_data.get("home_implied_prob", 0.33),
        "draw_implied_prob": match_data.get("draw_implied_prob", 0.33),
        "away_implied_prob": match_data.get("away_implied_prob", 0.34)
    }

def process_soccer_pipeline(matches: List[Dict[str, Any]], stats_db: Dict[str, Any]) -> pd.DataFrame:
    features_list = []
    for match in matches:
        feats = calculate_soccer_features(match, stats_db)
        feats['match_id'] = match.get('id', match.get('match_id'))
        features_list.append(feats)
        
    df = pd.DataFrame(features_list)
    return df
