import os
import lightgbm as lgb
import pandas as pd
import numpy as np
from typing import Dict, Any, List
import logging
from app.services.ml.soccer_features import calculate_soccer_features
from app.services.ml.baseball_features import calculate_baseball_features

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "ml_models")

class MLInferenceService:
    def __init__(self):
        self.soccer_model = None
        self.baseball_model = None
        self._load_models()
        
    def _load_models(self):
        """
        Cloud Run 컨테이너 메모리에 모델을 로드합니다.
        """
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
            
    def _format_prediction(self, match: Dict[str, Any], probs: Dict[str, float]) -> Dict[str, Any]:
        h_prob = probs.get("HOME", 33.3)
        d_prob = probs.get("DRAW", 33.3)
        a_prob = probs.get("AWAY", 33.4)
        
        best = max(h_prob, d_prob, a_prob)
        rec = "HOME" if best == h_prob else "AWAY" if best == a_prob else "DRAW"
        
        return {
            "match_id": f"{match.get('team_home', '')}_{match.get('team_away', '')}",
            "team_home": match.get("team_home", ""),
            "team_away": match.get("team_away", ""),
            "team_home_ko": match.get("team_home_ko"),
            "team_away_ko": match.get("team_away_ko"),
            "league": match.get("league", ""),
            "sport": match.get("sport", "Soccer"),
            "match_time": match.get("match_time"),
            "confidence": best,
            "recommendation": rec,
            "home_win_prob": h_prob,
            "draw_prob": d_prob,
            "away_win_prob": a_prob,
            "factors": [] # Will be filled by caller
        }

    def predict_matches(self, sport: str, matches: List[Dict[str, Any]], stats_db: Dict[str, Any]) -> List[Dict[str, Any]]:
        if not matches:
            return []
            
        if sport == "soccer":
            if not self.soccer_model:
                return self._heuristic_soccer_predict(matches, stats_db)
            
            # TODO: Integrate ML model prediction if model exists
            return self._heuristic_soccer_predict(matches, stats_db)
                
        elif sport == "baseball":
            return self._mock_predict(matches)
                
        return []

    def _calculate_heuristic_probs(self, features: Dict[str, float]) -> Dict[str, float]:
        """고차원 지표(xG, PPDA, Deep) 기반의 정밀 확률 계산 엔진"""
        h_score = 0.0
        a_score = 0.0
        
        # 1. xG 주도권 (가장 높은 가중치)
        h_score += features.get("home_xG_advantage", 0) * 1.8
        a_score += features.get("away_xG_advantage", 0) * 1.8
        
        # 2. 폼 및 모멘텀
        f_diff = features.get("form_diff", 0)
        if f_diff > 0: h_score += f_diff * 0.8
        else: a_score += abs(f_diff) * 0.8
        
        # 3. 압박 강도 (PPDA)
        p_diff = features.get("ppda_diff", 0)
        if p_diff > 0: h_score += p_diff * 0.4
        else: a_score += abs(p_diff) * 0.4
        
        # 4. 위험 지역 진입 (Deep Completions)
        d_diff = features.get("deep_diff", 0) / 10.0
        if d_diff > 0: h_score += d_diff * 0.5
        else: a_score += abs(d_diff) * 0.5
        
        # 5. 결정력 효율 (xG Overperformance)
        e_diff = features.get("xg_eff_diff", 0)
        if e_diff > 0: h_score += e_diff * 0.6
        else: a_score += abs(e_diff) * 0.6
        
        # 6. 점유율/피로도/부상
        h_score += features.get("possession_diff", 0) * 0.01
        h_score -= features.get("fatigue_diff", 0) * 0.3
        h_score -= features.get("injury_impact_diff", 0) * 0.4
        
        # Softmax 변환
        exp_h = np.exp(h_score)
        exp_a = np.exp(a_score)
        # 무승부 베이스라인 (점수가 비슷할수록 무승부 확률 상승)
        exp_d = np.exp(max(h_score, a_score) * 0.4) 
        
        total = exp_h + exp_a + exp_d
        return {
            "HOME": round((exp_h / total) * 100, 1),
            "DRAW": round((exp_d / total) * 100, 1),
            "AWAY": round((exp_a / total) * 100, 1)
        }

    def _heuristic_soccer_predict(self, matches: List[Dict[str, Any]], stats_db: Dict[str, Any]) -> List[Dict[str, Any]]:
        preds = []
        for match in matches:
            try:
                feats = calculate_soccer_features(match, stats_db)
                probs = self._calculate_heuristic_probs(feats)
                
                prediction = self._format_prediction(match, probs)
                
                # Align factors list with the 7-Factor Sports Data Scoring Engine
                from app.services.factor_scorer import calculate_factor_scores
                # Copy odds fields to ensure compatibility
                match_copy = dict(match)
                match_copy["home_odds"] = match_copy.get("home_odds") or match_copy.get("pin_home_odds") or 0.0
                match_copy["draw_odds"] = match_copy.get("draw_odds") or match_copy.get("pin_draw_odds") or 0.0
                match_copy["away_odds"] = match_copy.get("away_odds") or match_copy.get("pin_away_odds") or 0.0
                
                factor_res = calculate_factor_scores(match_copy)
                details = factor_res.get("details", {})
                
                prediction["factors"] = [
                    {"name": "전력 지수", "weight": 20, "score": details.get("power_rating", 50), "detail": "리그 순위 및 득실차 기반 전력 수준"},
                    {"name": "최근 경기 흐름", "weight": 15, "score": details.get("form_momentum", 50), "detail": "최근 5경기 경기 성적 흐름"},
                    {"name": "상대 전적", "weight": 10, "score": details.get("h2h_dominance", 50), "detail": "양 팀 간 최근 맞대결 성적"},
                    {"name": "부상 및 피로도", "weight": 15, "score": details.get("injury_fatigue", 50), "detail": "부상자 수 및 최근 일정 간격 피로도"},
                    {"name": "감독 지수", "weight": 10, "score": details.get("coach_factor", 50), "detail": "감독 전술 성향 및 임기 안정성"},
                    {"name": "선수단 경기력", "weight": 15, "score": details.get("squad_quality", 50), "detail": "점유율, xG 및 deep completions 경기력 세부 통계"},
                    {"name": "배당 내재 확률", "weight": 15, "score": details.get("market_implied", 50), "detail": "해외 메이저 북메이커 내재 확률 분석"}
                ]
                preds.append(prediction)
            except Exception as e:
                logger.warning(f"Heuristic failed for {match.get('team_home')}: {e}")
        return preds

    def _mock_predict(self, matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        preds = []
        for match in matches:
            probs = {"HOME": 40.0, "DRAW": 25.0, "AWAY": 35.0}
            preds.append(self._format_prediction(match, probs))
        return preds

ml_inference_service = MLInferenceService()
