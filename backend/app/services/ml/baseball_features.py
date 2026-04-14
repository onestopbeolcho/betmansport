import pandas as pd
import numpy as np
from typing import Dict, Any, List

def calculate_baseball_features(match_data: Dict[str, Any], team_stats: Dict[str, Any]) -> Dict[str, float]:
    """
    MLB/KBO 야구의 승무패(승/패) 분석을 위한 핵심 Feature 엔지니어링
    - 선발 투수(Starting Pitcher) 방어율 및 이닝 소화력
    - 팀 타선(Batting) wRC+ 또는 OPS 지원
    """
    home_team = match_data.get("home_team", "")
    away_team = match_data.get("away_team", "")
    
    home_stats = team_stats.get(home_team, {})
    away_stats = team_stats.get(away_team, {})
    
    # 1. 선발 투수 우위 (Pitching Advantage)
    home_sp_era = match_data.get("home_sp_era", 4.50) # 선발 투수 ERA
    away_sp_era = match_data.get("away_sp_era", 4.50)
    
    # 투수 방어율 차이 (음수일수록 홈 투수 우위)
    sp_era_diff = home_sp_era - away_sp_era
    
    # 2. 타선 득점 생산력 (Batting Productivity)
    # wRC+ (100이 평균) 또는 팀 OPS 활용
    home_wrc_plus = home_stats.get("season_wrc_plus", 100.0)
    away_wrc_plus = away_stats.get("season_wrc_plus", 100.0)
    
    batting_diff = home_wrc_plus - away_wrc_plus # 양수면 홈 타선 우위
    
    # 3. 불펜 안정성 (Bullpen Stability)
    home_bullpen_era = home_stats.get("bullpen_era", 4.00)
    away_bullpen_era = away_stats.get("bullpen_era", 4.00)
    
    bullpen_diff = home_bullpen_era - away_bullpen_era # 음수면 홈 불펜 우위
    
    # 4. 상대 상성 등
    
    return {
        "sp_era_diff": sp_era_diff,
        "batting_diff": batting_diff,
        "bullpen_diff": bullpen_diff,
        "home_implied_prob": match_data.get("home_implied_prob", 0.5),
        "away_implied_prob": match_data.get("away_implied_prob", 0.5)
    }

def process_baseball_pipeline(matches: List[Dict[str, Any]], stats_db: Dict[str, Any]) -> pd.DataFrame:
    features_list = []
    for match in matches:
        feats = calculate_baseball_features(match, stats_db)
        feats['match_id'] = match.get('id')
        features_list.append(feats)
        
    df = pd.DataFrame(features_list)
    return df
