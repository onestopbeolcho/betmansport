import os
import lightgbm as lgb
import pandas as pd
from typing import Dict, Any, List
from app.services.ml.soccer_features import calculate_soccer_features
from app.services.ml.baseball_features import calculate_baseball_features

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml_models")

class MLInferenceService:
    def __init__(self):
        self.soccer_model = None
        self.baseball_model = None
        self._load_models()
        
    def _load_models(self):
        """
        Cloud Run 컨테이너 메모리에 모델을 로드합니다.
        Cold start 시 지연이 발생할 수 있으나, Vertex AI Endpoint 대기 비용을 크게 절감합니다.
        """
        soccer_model_path = os.path.join(MODELS_DIR, "soccer_model_lgb.txt")
        baseball_model_path = os.path.join(MODELS_DIR, "baseball_model_lgb.txt")
        
        if os.path.exists(soccer_model_path):
            self.soccer_model = lgb.Booster(model_file=soccer_model_path)
            print(f"Loaded Soccer Model from {soccer_model_path}")
            
        if os.path.exists(baseball_model_path):
            self.baseball_model = lgb.Booster(model_file=baseball_model_path)
            print(f"Loaded Baseball Model from {baseball_model_path}")
            
    def _format_prediction(self, match: Dict[str, Any], win_prob: float) -> Dict[str, Any]:
        h_prob = round(win_prob * 100, 1)
        d_prob = round(((1 - win_prob) * 0.25) * 100, 1)  # Rough heuristic for draw taking 25% of the rest
        a_prob = round(((1 - win_prob) * 0.75) * 100, 1)
        score = h_prob
        rec = "HOME" if h_prob > a_prob and h_prob > d_prob else "AWAY" if a_prob > d_prob else "DRAW"
        
        return {
            "match_id": f"{match.get('team_home', '')}_{match.get('team_away', '')}",
            "team_home": match.get("team_home", ""),
            "team_away": match.get("team_away", ""),
            "team_home_ko": match.get("team_home_ko"),
            "team_away_ko": match.get("team_away_ko"),
            "league": match.get("league", ""),
            "sport": match.get("sport", "Soccer"),
            "match_time": match.get("match_time"),
            "confidence": score,
            "recommendation": rec,
            "home_win_prob": h_prob,
            "draw_prob": d_prob,
            "away_win_prob": a_prob,
            "factors": [{"name": "AI Model Win Prob", "weight": 100, "score": score, "detail": "ML inferred probability"}]
        }

    def predict_matches(self, sport: str, matches: List[Dict[str, Any]], stats_db: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        입력된 다수의 경기에 대하여 전처리 및 예측을 수행합니다.
        """
        if not matches:
            return []
            
        predictions = []
        if sport == "soccer":
            if not self.soccer_model:
                return self._heuristic_soccer_predict(matches, stats_db)
                
            features_list = []
            valid_matches = []
            for match in matches:
                feats = calculate_soccer_features(match, stats_db)
                if feats:
                    features_list.append(feats)
                    valid_matches.append(match)
                
            if features_list:
                df = pd.DataFrame(features_list)
                preds = self.soccer_model.predict(df)
                for i, match in enumerate(valid_matches):
                    predictions.append(self._format_prediction(match, float(preds[i])))
                
        elif sport == "baseball":
            if not self.baseball_model:
                return self._mock_predict(matches)
                
            features_list = []
            valid_matches = []
            for match in matches:
                feats = calculate_baseball_features(match, stats_db)
                if feats:
                    features_list.append(feats)
                    valid_matches.append(match)
                
            if features_list:
                df = pd.DataFrame(features_list)
                preds = self.baseball_model.predict(df)
                for i, match in enumerate(valid_matches):
                    predictions.append(self._format_prediction(match, float(preds[i])))
                
        return predictions

    def _heuristic_soccer_predict(self, matches: List[Dict[str, Any]], stats_db: Dict[str, Any]) -> List[Dict[str, Any]]:
        """모델 파일이 없을 때 사용되는 축구 특화 휴리스틱 추론 엔진"""
        preds = []
        for match in matches:
            feats = calculate_soccer_features(match, stats_db)
            
            # Base probability (implied from market odds if available)
            base_prob = match.get("home_implied_prob", 0.40)
            
            # Heuristic score adjustments
            adj = (feats.get("home_dominance_idx", 0) * 0.05 +
                   feats.get("form_diff", 0) * 0.04 +
                   feats.get("possession_diff", 0) * 0.001 -
                   feats.get("fatigue_diff", 0) * 0.05 -
                   feats.get("injury_impact_diff", 0) * 0.06)
                   
            win_prob = max(0.05, min(0.95, base_prob + adj))
            
            prediction = self._format_prediction(match, win_prob)
            
            # Add detailed factor breakdown for VIP display
            prediction["factors"] = [
                {"name": "Form & Momentum", "weight": 40, "score": feats.get("form_diff", 0), "detail": "최근 경기 흐름 차이"},
                {"name": "xG Dominance", "weight": 35, "score": feats.get("home_dominance_idx", 0), "detail": "기대 득점 기반 지배력"},
                {"name": "Fatigue", "weight": 10, "score": -feats.get("fatigue_diff", 0), "detail": "최근 일정 피로도 격차"},
                {"name": "Injury Impact", "weight": 15, "score": -feats.get("injury_impact_diff", 0), "detail": "주요 선수 결장 타격"}
            ]
            preds.append(prediction)
        return preds

    def _mock_predict(self, matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """모델 파일이 없을 때를 대비한 Fallback (초기 테스트용)"""
        preds = []
        for match in matches:
            home_implied = match.get("home_implied_prob", 0.5)
            preds.append(self._format_prediction(match, home_implied * 1.05))
        return preds

ml_inference_service = MLInferenceService()
