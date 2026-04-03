"""
Self-Learning Pipeline (오답 노트 기반 자가 학습)
매일 새벽 03:00 KST 실행:
  Step 1: 어제 경기 결과 수집 → 예측과 비교
  Step 2: Loss 계산 → LightGBM Incremental Retraining
  Step 3: Feature Importance Shift 추출 → 오답 노트 JSON 생성
"""
import logging
import os
import math
import numpy as np
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple

from app.services import bigquery_service as bq
from app.services.feature_store import extract_features_with_odds, get_feature_names
from app.core.model_store import save_model, load_model

logger = logging.getLogger(__name__)

PROJECT_ID = bq.PROJECT_ID
DATASET_ID = bq.DATASET_ID


class SelfLearningPipeline:
    """
    오답 노트 기반 ML 모델 자가 학습 파이프라인.
    """

    def __init__(self):
        self.results = []
        self.error_report = {}
        self.retraining_summary = {}

    async def run_nightly(self) -> Dict:
        """
        Full nightly pipeline execution.
        Returns summary of what was learned.
        """
        logger.info("🌙 Starting nightly self-learning pipeline...")

        # Step 1: Collect yesterday's results
        results = await self._step1_collect_results()
        if not results:
            logger.info("No completed matches found for yesterday. Skipping.")
            return {"status": "skipped", "reason": "no_completed_matches"}

        # Step 2: Calculate loss and retrain
        error_report = self._step2_calculate_loss(results)

        # Step 3: Retrain model if we have enough data
        retrain_result = await self._step3_retrain_model(results, error_report)

        # Step 4: Generate error analysis JSON (for Gemini to narrate)
        error_note = self._generate_error_note(error_report, retrain_result)

        summary = {
            "status": "completed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "matches_evaluated": len(results),
            "accuracy": error_report.get("accuracy_pct", 0),
            "avg_log_loss": error_report.get("avg_log_loss", 0),
            "model_updated": retrain_result.get("model_updated", False),
            "new_model_version": retrain_result.get("new_version", ""),
            "error_note": error_note,
        }

        logger.info(f"✅ Nightly pipeline complete: {summary}")
        return summary

    async def _step1_collect_results(self) -> List[Dict]:
        """
        Step 1: Collect yesterday's match results from API-Football.
        Map actual results to predictions in BigQuery.
        """
        # Get yesterday's predictions that haven't been settled yet
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        sql = f"""
        SELECT p.match_id, p.model_version,
               p.pred_home, p.pred_draw, p.pred_away,
               p.recommendation, p.confidence,
               p.predicted_at
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
        WHERE p.actual_result IS NULL
          AND DATE(p.predicted_at) <= '{yesterday}'
        ORDER BY p.predicted_at DESC
        LIMIT 100
        """
        predictions = await bq.query(sql)
        if not predictions:
            return []

        # Try to match with actual results from matches_raw
        settled = []
        for pred in predictions:
            match_id = pred["match_id"]

            # Look up actual result
            result_sql = f"""
            SELECT result, home_score, away_score
            FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
            WHERE match_id = '{match_id}'
            LIMIT 1
            """
            results = await bq.query(result_sql)
            if results and results[0].get("result"):
                actual = results[0]["result"]  # HOME / DRAW / AWAY
                pred["actual_result"] = actual
                pred["home_score"] = results[0].get("home_score")
                pred["away_score"] = results[0].get("away_score")

                # Update predictions_log with actual result
                correct = pred["recommendation"] == actual
                log_loss = self._calc_log_loss(
                    pred["pred_home"], pred["pred_draw"], pred["pred_away"], actual
                )
                update_sql = f"""
                UPDATE `{PROJECT_ID}.{DATASET_ID}.predictions_log`
                SET actual_result = '{actual}',
                    correct = {str(correct).upper()},
                    log_loss = {log_loss},
                    settled_at = CURRENT_TIMESTAMP()
                WHERE match_id = '{match_id}'
                  AND actual_result IS NULL
                """
                try:
                    await bq.query(update_sql)
                except Exception as e:
                    logger.warning(f"Failed to update prediction log: {e}")

                settled.append(pred)

        logger.info(f"Step 1: {len(settled)} matches settled out of {len(predictions)} pending")
        return settled

    def _step2_calculate_loss(self, results: List[Dict]) -> Dict:
        """
        Step 2: Calculate prediction accuracy and loss metrics.
        """
        if not results:
            return {"accuracy_pct": 0, "avg_log_loss": 0, "total": 0}

        correct = 0
        total_loss = 0
        big_misses = []

        for r in results:
            actual = r.get("actual_result", "")
            predicted = r.get("recommendation", "")

            if predicted == actual:
                correct += 1

            # Calculate log loss
            loss = self._calc_log_loss(
                r.get("pred_home", 0.33),
                r.get("pred_draw", 0.33),
                r.get("pred_away", 0.33),
                actual,
            )
            total_loss += loss

            # Identify big misses (high confidence but wrong)
            confidence = r.get("confidence", 0)
            if predicted != actual and confidence > 60:
                big_misses.append({
                    "match_id": r["match_id"],
                    "predicted": predicted,
                    "actual": actual,
                    "confidence": confidence,
                    "pred_probs": {
                        "home": r.get("pred_home", 0),
                        "draw": r.get("pred_draw", 0),
                        "away": r.get("pred_away", 0),
                    },
                })

        total = len(results)
        report = {
            "total": total,
            "correct": correct,
            "accuracy_pct": round((correct / total) * 100, 1) if total > 0 else 0,
            "avg_log_loss": round(total_loss / total, 4) if total > 0 else 0,
            "big_misses": big_misses[:10],  # Top 10 biggest errors
            "big_miss_count": len(big_misses),
        }

        logger.info(
            f"Step 2: Accuracy={report['accuracy_pct']}%, "
            f"Avg Loss={report['avg_log_loss']}, "
            f"Big Misses={report['big_miss_count']}"
        )
        return report

    async def _step3_retrain_model(self, results: List[Dict], error_report: Dict) -> Dict:
        """
        Step 3: Incremental retraining of LightGBM model.
        """
        # Need minimum data for meaningful retraining
        MIN_SAMPLES = 10
        if len(results) < MIN_SAMPLES:
            return {
                "model_updated": False,
                "reason": f"Insufficient data ({len(results)} < {MIN_SAMPLES})",
                "new_version": "",
            }

        try:
            import lightgbm as lgb
            from sklearn.preprocessing import LabelEncoder

            # Load current model for comparison
            old_model = load_model("lightgbm_predictor")
            old_importances = {}
            if old_model:
                feature_names = get_feature_names()
                try:
                    old_importances = {
                        name: float(imp)
                        for name, imp in zip(feature_names, old_model.feature_importances_)
                    }
                except Exception:
                    pass

            # Build training data from BigQuery (last 30 days of settled predictions)
            training_sql = f"""
            SELECT p.match_id, p.pred_home, p.pred_draw, p.pred_away,
                   p.actual_result,
                   m.home_team, m.away_team, m.league
            FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
            JOIN `{PROJECT_ID}.{DATASET_ID}.matches_raw` m
              ON p.match_id = m.match_id
            WHERE p.actual_result IS NOT NULL
            ORDER BY p.predicted_at DESC
            LIMIT 500
            """
            training_data = await bq.query(training_sql)

            if len(training_data) < MIN_SAMPLES:
                return {
                    "model_updated": False,
                    "reason": f"Insufficient training data ({len(training_data)})",
                    "new_version": "",
                }

            # Extract features for each match
            feature_names = get_feature_names()
            X_list = []
            y_list = []

            for td in training_data:
                try:
                    features = await extract_features_with_odds(
                        home_team=td.get("home_team", ""),
                        away_team=td.get("away_team", ""),
                        league=td.get("league", ""),
                        home_odds=1 / max(td.get("pred_home", 0.33), 0.01),
                        draw_odds=1 / max(td.get("pred_draw", 0.33), 0.01),
                        away_odds=1 / max(td.get("pred_away", 0.33), 0.01),
                    )
                    X_row = [features.get(f, 0.0) for f in feature_names]
                    X_list.append(X_row)
                    y_list.append(td["actual_result"])  # HOME / DRAW / AWAY
                except Exception as e:
                    logger.warning(f"Feature extraction failed for {td.get('match_id')}: {e}")
                    continue

            if len(X_list) < MIN_SAMPLES:
                return {
                    "model_updated": False,
                    "reason": "Feature extraction yielded too few samples",
                    "new_version": "",
                }

            X = np.array(X_list)
            le = LabelEncoder()
            y = le.fit_transform(y_list)

            # Train new LightGBM model
            train_data = lgb.Dataset(X, label=y, feature_name=feature_names)
            params = {
                "objective": "multiclass",
                "num_class": 3,
                "metric": "multi_logloss",
                "learning_rate": 0.05,
                "num_leaves": 31,
                "max_depth": 6,
                "min_child_samples": 5,
                "feature_fraction": 0.8,
                "bagging_fraction": 0.8,
                "bagging_freq": 5,
                "verbose": -1,
            }

            # If we have an old model, use warm start
            if old_model:
                new_model = lgb.train(
                    params,
                    train_data,
                    num_boost_round=50,
                    init_model=old_model,
                )
            else:
                new_model = lgb.train(
                    params,
                    train_data,
                    num_boost_round=200,
                )

            # Save new model
            new_version = datetime.now(timezone.utc).strftime("%Y%m%d")
            model_path = save_model(new_model, "lightgbm_predictor", new_version)

            # Calculate new feature importances
            new_importances = {
                name: float(imp)
                for name, imp in zip(feature_names, new_model.feature_importance())
            }

            # Log feature importance changes to BigQuery
            await bq.log_feature_importance(
                f"v{new_version}", new_importances, old_importances
            )

            # Compute importance shifts
            importance_shifts = []
            for feat in feature_names:
                old_val = old_importances.get(feat, 0)
                new_val = new_importances.get(feat, 0)
                if old_val > 0:
                    shift_pct = ((new_val - old_val) / old_val) * 100
                else:
                    shift_pct = 100 if new_val > 0 else 0
                importance_shifts.append({
                    "feature": feat,
                    "old_weight": round(old_val, 4),
                    "new_weight": round(new_val, 4),
                    "shift_pct": round(shift_pct, 1),
                })

            # Sort by absolute shift
            importance_shifts.sort(key=lambda x: abs(x["shift_pct"]), reverse=True)

            logger.info(f"✅ Model retrained. Version: v{new_version}, Path: {model_path}")
            logger.info(f"Top shifts: {importance_shifts[:3]}")

            return {
                "model_updated": True,
                "new_version": f"v{new_version}",
                "model_path": model_path,
                "training_samples": len(X_list),
                "importance_shifts": importance_shifts[:10],
                "new_importances": new_importances,
            }

        except ImportError as e:
            logger.error(f"LightGBM not installed: {e}")
            return {"model_updated": False, "reason": str(e), "new_version": ""}
        except Exception as e:
            logger.error(f"Retraining failed: {e}")
            return {"model_updated": False, "reason": str(e), "new_version": ""}

    def _generate_error_note(self, error_report: Dict, retrain_result: Dict) -> Dict:
        """
        Generate structured 오답 노트 JSON for Gemini to narrate.
        This is the input payload for Phase 4 VIP report generation.
        """
        note = {
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "summary": {
                "matches_evaluated": error_report.get("total", 0),
                "accuracy_pct": error_report.get("accuracy_pct", 0),
                "avg_log_loss": error_report.get("avg_log_loss", 0),
            },
            "big_misses": [],
            "learning_actions": [],
        }

        # Extract big misses for human-readable narration
        for miss in error_report.get("big_misses", [])[:5]:
            note["big_misses"].append({
                "match": miss["match_id"].replace("_", " vs "),
                "predicted": miss["predicted"],
                "actual": miss["actual"],
                "confidence": miss["confidence"],
            })

        # Extract learning actions (feature importance shifts)
        if retrain_result.get("model_updated"):
            for shift in retrain_result.get("importance_shifts", [])[:5]:
                if abs(shift["shift_pct"]) > 5:  # Only notable shifts
                    direction = "increased" if shift["shift_pct"] > 0 else "decreased"
                    note["learning_actions"].append({
                        "feature": shift["feature"],
                        "direction": direction,
                        "shift_pct": shift["shift_pct"],
                        "description": f"{shift['feature']} weight {direction} by {abs(shift['shift_pct'])}%",
                    })

        return note

    @staticmethod
    def _calc_log_loss(pred_home: float, pred_draw: float, pred_away: float, actual: str) -> float:
        """Calculate log loss for a single prediction."""
        eps = 1e-10
        probs = {
            "HOME": max(pred_home, eps),
            "DRAW": max(pred_draw, eps),
            "AWAY": max(pred_away, eps),
        }
        actual_prob = probs.get(actual, eps)
        return -math.log(actual_prob)


# Singleton
self_learning_pipeline = SelfLearningPipeline()
