"""
ML Predictor — LightGBM 기반 승률 예측 엔진.
기존 ai_predictor.py의 6-Factor 수동 가중치 → ML 자동 학습 가중치로 교체.
Fallback: ML 모델 미로드 시 기존 AIPredictor 사용.
"""
import logging
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone

from app.services.feature_store import extract_features_with_odds, get_feature_names
from app.core.model_store import load_model, save_model
from app.services import bigquery_service as bq

logger = logging.getLogger(__name__)

# Current model version
MODEL_VERSION = "v1"


class MLPredictor:
    """
    LightGBM 기반 확률 예측 엔진.
    AIPredictor를 대체하여 학습된 가중치로 예측.
    """

    def __init__(self):
        self._model = None
        self._model_loaded = False
        self._fallback_predictor = None
        self._load_model()

    def _load_model(self):
        """Load the latest trained model."""
        try:
            self._model = load_model("lightgbm_predictor")
            if self._model is not None:
                self._model_loaded = True
                logger.info("✅ ML model loaded successfully")
            else:
                logger.warning("No trained ML model found, will use fallback")
                self._init_fallback()
        except Exception as e:
            logger.warning(f"ML model load failed: {e}, using fallback")
            self._init_fallback()

    def _init_fallback(self):
        """Initialize legacy AIPredictor as fallback."""
        try:
            from app.core.ai_predictor import AIPredictor
            self._fallback_predictor = AIPredictor()
            logger.info("Fallback AIPredictor initialized")
        except Exception as e:
            logger.error(f"Fallback predictor also failed: {e}")

    @property
    def is_ml_ready(self) -> bool:
        """Check if ML model is loaded and ready."""
        return self._model_loaded and self._model is not None

    async def predict(
        self,
        home_team: str,
        away_team: str,
        league: str,
        home_odds: float = 0,
        draw_odds: float = 0,
        away_odds: float = 0,
        missing_players_home: int = 0,
        missing_players_away: int = 0,
        match_date: Optional[str] = None,
    ) -> Dict:
        """
        Generate prediction for a single match.
        Returns probability distribution + top features.
        """
        if not self.is_ml_ready:
            return await self._predict_fallback(
                home_team, away_team, league,
                home_odds, draw_odds, away_odds
            )

        try:
            # Extract features
            features = await extract_features_with_odds(
                home_team=home_team,
                away_team=away_team,
                league=league,
                home_odds=home_odds,
                draw_odds=draw_odds,
                away_odds=away_odds,
                missing_players_home=missing_players_home,
                missing_players_away=missing_players_away,
                match_date=match_date,
            )

            # Build feature vector in correct order
            feature_names = get_feature_names()
            X = np.array([[features.get(f, 0.0) for f in feature_names]])

            # Predict probabilities
            probs = self._model.predict_proba(X)[0]

            # Map to home/draw/away (class order depends on training)
            classes = list(self._model.classes_)
            prob_map = {}
            for i, cls in enumerate(classes):
                prob_map[cls] = float(probs[i])

            home_prob = prob_map.get("HOME", prob_map.get(0, 0.33))
            draw_prob = prob_map.get("DRAW", prob_map.get(1, 0.33))
            away_prob = prob_map.get("AWAY", prob_map.get(2, 0.33))

            # Determine recommendation
            max_prob = max(home_prob, draw_prob, away_prob)
            if home_prob == max_prob:
                recommendation = "HOME"
            elif away_prob == max_prob:
                recommendation = "AWAY"
            else:
                recommendation = "DRAW"

            # Get top contributing features
            top_features = self._get_top_features(features, feature_names)

            result = {
                "match_id": f"{home_team}_{away_team}",
                "model_version": MODEL_VERSION,
                "predictions": {
                    "home_win": round(home_prob, 4),
                    "draw": round(draw_prob, 4),
                    "away_win": round(away_prob, 4),
                },
                "recommendation": recommendation,
                "confidence": round(max_prob * 100, 1),
                "top_features": top_features,
                "engine": "lightgbm",
            }

            # Log prediction to BigQuery
            await bq.log_prediction(
                match_id=result["match_id"],
                model_version=MODEL_VERSION,
                pred_home=home_prob,
                pred_draw=draw_prob,
                pred_away=away_prob,
                recommendation=recommendation,
                confidence=max_prob * 100,
            )

            return result

        except Exception as e:
            logger.error(f"ML prediction failed: {e}, using fallback")
            return await self._predict_fallback(
                home_team, away_team, league,
                home_odds, draw_odds, away_odds
            )

    async def predict_batch(self, matches: List[Dict]) -> List[Dict]:
        """Predict multiple matches at once."""
        results = []
        for match in matches:
            result = await self.predict(
                home_team=match.get("team_home", ""),
                away_team=match.get("team_away", ""),
                league=match.get("league", ""),
                home_odds=float(match.get("home_odds", 0)),
                draw_odds=float(match.get("draw_odds", 0)),
                away_odds=float(match.get("away_odds", 0)),
                missing_players_home=int(match.get("missing_home", 0)),
                missing_players_away=int(match.get("missing_away", 0)),
            )
            results.append(result)
        return results

    def _get_top_features(self, features: Dict, feature_names: List[str], top_n: int = 5) -> List[Dict]:
        """Get top N most influential features for this prediction."""
        if not self.is_ml_ready:
            return []

        try:
            importances = self._model.feature_importances_
            feature_importance = sorted(
                zip(feature_names, importances),
                key=lambda x: x[1],
                reverse=True
            )[:top_n]

            return [
                {
                    "feature": name,
                    "importance": round(float(imp), 4),
                    "value": round(features.get(name, 0), 4),
                }
                for name, imp in feature_importance
            ]
        except Exception:
            return []

    def get_feature_importance(self) -> Dict[str, float]:
        """Get full feature importance map."""
        if not self.is_ml_ready:
            return {}

        try:
            feature_names = get_feature_names()
            importances = self._model.feature_importances_
            return {
                name: float(imp)
                for name, imp in zip(feature_names, importances)
            }
        except Exception:
            return {}

    async def _predict_fallback(
        self,
        home_team: str,
        away_team: str,
        league: str,
        home_odds: float,
        draw_odds: float,
        away_odds: float,
    ) -> Dict:
        """
        Fallback to legacy AIPredictor when ML model is unavailable.
        """
        # Simple odds-implied probability calculation
        if home_odds > 1 and away_odds > 1:
            total = (1 / home_odds) + (1 / (draw_odds or 3.0)) + (1 / away_odds)
            home_prob = (1 / home_odds) / total
            draw_prob = (1 / (draw_odds or 3.0)) / total
            away_prob = (1 / away_odds) / total
        else:
            home_prob = draw_prob = away_prob = 0.33

        max_prob = max(home_prob, draw_prob, away_prob)
        if home_prob == max_prob:
            recommendation = "HOME"
        elif away_prob == max_prob:
            recommendation = "AWAY"
        else:
            recommendation = "DRAW"

        return {
            "match_id": f"{home_team}_{away_team}",
            "model_version": "fallback_v0",
            "predictions": {
                "home_win": round(home_prob, 4),
                "draw": round(draw_prob, 4),
                "away_win": round(away_prob, 4),
            },
            "recommendation": recommendation,
            "confidence": round(max_prob * 100, 1),
            "top_features": [
                {"feature": "implied_prob (odds-based)", "importance": 1.0, "value": max_prob}
            ],
            "engine": "fallback_odds_implied",
        }

    def reload_model(self):
        """Force reload model from storage (called after retraining)."""
        self._model = None
        self._model_loaded = False
        self._load_model()
        return self.is_ml_ready


# Lazy singleton — initialized on first access, not on import
_ml_predictor_instance = None

def _get_ml_predictor():
    global _ml_predictor_instance
    if _ml_predictor_instance is None:
        _ml_predictor_instance = MLPredictor()
    return _ml_predictor_instance

class _LazyMLPredictor:
    """Proxy that delays MLPredictor instantiation until first attribute access."""
    def __getattr__(self, name):
        # is_ml_ready should return False if MLPredictor hasn't been instantiated yet
        # to avoid blocking requests with model loading
        if name == 'is_ml_ready' and _ml_predictor_instance is None:
            return False
        return getattr(_get_ml_predictor(), name)

ml_predictor = _LazyMLPredictor()
