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
    
    home_xG_for = home_stats.get("avg_xG_for", 1.0)
    home_xG_against = home_stats.get("avg_xG_against", 1.5)
    away_xG_for = away_stats.get("avg_xG_for", 1.0)
    away_xG_against = away_stats.get("avg_xG_against", 1.5)
    
    # 경기 지배력 지수 (팀 전체 득실 기대치 차이)
    home_dominance_index = home_xG_for - home_xG_against
    away_dominance_index = away_xG_for - away_xG_against
    
    # 2. 피로도 패턴 (최근 경기 수 기반)
    home_recent_matches_14d = home_stats.get("matches_last_14_days", 2)
    away_recent_matches_14d = away_stats.get("matches_last_14_days", 2)
    
    home_fatigue = min(home_recent_matches_14d * 0.15, 1.0)
    away_fatigue = min(away_recent_matches_14d * 0.15, 1.0)
    
    # 3. 홈/원정 특화 공격/수비력
    home_home_xG_for = home_stats.get("avg_home_xG_for", home_xG_for)
    away_away_xG_for = away_stats.get("avg_away_xG_for", away_xG_for)
    
    # 4. Form (최근 성적 모멘텀)
    home_form = home_stats.get("form_index", 1.0)
    away_form = away_stats.get("form_index", 1.0)
    
    # 5. 주도권 (Possession) 
    home_possession = home_stats.get("possession_avg", 50.0)
    away_possession = away_stats.get("possession_avg", 50.0)
    
    # 6. 결장자 치명도 (Injury Impact)
    home_injury_impact = home_stats.get("injury_impact_score", 0.0)
    away_injury_impact = away_stats.get("injury_impact_score", 0.0)
    
    return {
        "home_dominance_idx": home_dominance_index,
        "away_dominance_idx": away_dominance_index,
        "fatigue_diff": home_fatigue - away_fatigue, # 양수면 홈팀 피로도가 더 높음
        "home_xG_advantage": home_home_xG_for - away_xG_against,
        "away_xG_advantage": away_away_xG_for - home_xG_against,
        "form_diff": home_form - away_form, 
        "possession_diff": home_possession - away_possession,
        "injury_impact_diff": home_injury_impact - away_injury_impact, # 음수일수록 홈팀에게 우호적
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
