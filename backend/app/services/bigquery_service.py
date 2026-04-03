"""
BigQuery Data Lake Service
- AI 학습용 시계열 데이터 저장/조회
- matches_raw, team_stats, odds_history, predictions_log, feature_importance
- Firestore 부하 경감을 위해 무거운 원본 데이터를 BQ로 이관
"""
import logging
import os
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

# Lazy-loaded client
_bq_client = None
_initialized = False

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "smart-proto-inv-2026")
DATASET_ID = os.getenv("BQ_DATASET_ID", "scorenix_datalake")


def _get_bq_client():
    """Lazy-init BigQuery client."""
    global _bq_client, _initialized
    if _initialized:
        return _bq_client
    _initialized = True
    try:
        from google.cloud import bigquery
        _bq_client = bigquery.Client(project=PROJECT_ID)
        logger.info(f"✅ BigQuery client initialized (project={PROJECT_ID})")
        return _bq_client
    except Exception as e:
        logger.warning(f"BigQuery init failed (will use in-memory fallback): {e}")
        return None


# ─── Table Schemas ───

TABLES = {
    "matches_raw": [
        {"name": "match_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "league", "type": "STRING"},
        {"name": "season", "type": "STRING"},
        {"name": "match_date", "type": "TIMESTAMP"},
        {"name": "home_team", "type": "STRING"},
        {"name": "away_team", "type": "STRING"},
        {"name": "home_score", "type": "INTEGER"},
        {"name": "away_score", "type": "INTEGER"},
        {"name": "result", "type": "STRING"},  # HOME / DRAW / AWAY
        {"name": "home_shots", "type": "INTEGER"},
        {"name": "away_shots", "type": "INTEGER"},
        {"name": "home_possession", "type": "FLOAT"},
        {"name": "away_possession", "type": "FLOAT"},
        {"name": "home_corners", "type": "INTEGER"},
        {"name": "away_corners", "type": "INTEGER"},
        {"name": "venue", "type": "STRING"},
        {"name": "referee", "type": "STRING"},
        {"name": "ingested_at", "type": "TIMESTAMP"},
    ],
    "team_stats": [
        {"name": "team", "type": "STRING", "mode": "REQUIRED"},
        {"name": "league", "type": "STRING", "mode": "REQUIRED"},
        {"name": "season", "type": "STRING"},
        {"name": "rank", "type": "INTEGER"},
        {"name": "points", "type": "INTEGER"},
        {"name": "played", "type": "INTEGER"},
        {"name": "wins", "type": "INTEGER"},
        {"name": "draws", "type": "INTEGER"},
        {"name": "losses", "type": "INTEGER"},
        {"name": "goals_for", "type": "INTEGER"},
        {"name": "goals_against", "type": "INTEGER"},
        {"name": "goal_diff", "type": "INTEGER"},
        {"name": "form_last5", "type": "STRING"},  # e.g., "WWDLL"
        {"name": "home_wins", "type": "INTEGER"},
        {"name": "home_draws", "type": "INTEGER"},
        {"name": "home_losses", "type": "INTEGER"},
        {"name": "away_wins", "type": "INTEGER"},
        {"name": "away_draws", "type": "INTEGER"},
        {"name": "away_losses", "type": "INTEGER"},
        {"name": "updated_at", "type": "TIMESTAMP"},
    ],
    "odds_history": [
        {"name": "match_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "provider", "type": "STRING"},  # pinnacle / betman
        {"name": "league", "type": "STRING"},
        {"name": "home_team", "type": "STRING"},
        {"name": "away_team", "type": "STRING"},
        {"name": "home_odds", "type": "FLOAT"},
        {"name": "draw_odds", "type": "FLOAT"},
        {"name": "away_odds", "type": "FLOAT"},
        {"name": "match_time", "type": "TIMESTAMP"},
        {"name": "collected_at", "type": "TIMESTAMP"},
    ],
    "predictions_log": [
        {"name": "match_id", "type": "STRING", "mode": "REQUIRED"},
        {"name": "model_version", "type": "STRING"},
        {"name": "pred_home", "type": "FLOAT"},
        {"name": "pred_draw", "type": "FLOAT"},
        {"name": "pred_away", "type": "FLOAT"},
        {"name": "recommendation", "type": "STRING"},
        {"name": "confidence", "type": "FLOAT"},
        {"name": "actual_result", "type": "STRING"},  # HOME / DRAW / AWAY / null
        {"name": "log_loss", "type": "FLOAT"},
        {"name": "correct", "type": "BOOLEAN"},
        {"name": "predicted_at", "type": "TIMESTAMP"},
        {"name": "settled_at", "type": "TIMESTAMP"},
    ],
    "feature_importance": [
        {"name": "model_version", "type": "STRING", "mode": "REQUIRED"},
        {"name": "feature", "type": "STRING", "mode": "REQUIRED"},
        {"name": "weight", "type": "FLOAT"},
        {"name": "weight_delta", "type": "FLOAT"},  # vs previous version
        {"name": "rank", "type": "INTEGER"},
        {"name": "recorded_at", "type": "TIMESTAMP"},
    ],
}


async def ensure_dataset_and_tables():
    """Create dataset and tables if they don't exist."""
    client = _get_bq_client()
    if not client:
        logger.warning("BigQuery client unavailable, skipping table creation")
        return False

    from google.cloud import bigquery

    # Create dataset
    dataset_ref = f"{PROJECT_ID}.{DATASET_ID}"
    try:
        client.get_dataset(dataset_ref)
        logger.info(f"Dataset {dataset_ref} already exists")
    except Exception:
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "asia-northeast3"  # Seoul
        client.create_dataset(dataset, exists_ok=True)
        logger.info(f"✅ Created dataset: {dataset_ref}")

    # Create tables
    for table_name, schema_fields in TABLES.items():
        table_ref = f"{dataset_ref}.{table_name}"
        schema = [bigquery.SchemaField(**f) for f in schema_fields]
        try:
            client.get_table(table_ref)
            logger.info(f"Table {table_name} already exists")
        except Exception:
            table = bigquery.Table(table_ref, schema=schema)
            # Partition matches_raw and odds_history by date for cost optimization
            if table_name in ("matches_raw", "odds_history"):
                table.time_partitioning = bigquery.TimePartitioning(
                    type_=bigquery.TimePartitioningType.DAY,
                    field="match_date" if table_name == "matches_raw" else "collected_at",
                )
            client.create_table(table, exists_ok=True)
            logger.info(f"✅ Created table: {table_name}")

    return True


async def insert_rows(table_name: str, rows: List[Dict[str, Any]]) -> bool:
    """Insert rows into a BigQuery table."""
    client = _get_bq_client()
    if not client or not rows:
        return False

    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"

    # Add ingested_at if not present
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        if "ingested_at" not in row and "collected_at" not in row and "updated_at" not in row:
            row["ingested_at"] = now

    try:
        errors = client.insert_rows_json(table_ref, rows)
        if errors:
            logger.error(f"BigQuery insert errors for {table_name}: {errors[:3]}")
            return False
        logger.info(f"✅ Inserted {len(rows)} rows into {table_name}")
        return True
    except Exception as e:
        logger.error(f"BigQuery insert failed for {table_name}: {e}")
        return False


async def query(sql: str) -> List[Dict[str, Any]]:
    """Execute a BigQuery SQL query and return results as dicts."""
    client = _get_bq_client()
    if not client:
        return []

    try:
        query_job = client.query(sql)
        results = query_job.result()
        rows = []
        for row in results:
            rows.append(dict(row))
        logger.info(f"BigQuery query returned {len(rows)} rows")
        return rows
    except Exception as e:
        logger.error(f"BigQuery query failed: {e}")
        return []


async def get_team_recent_matches(team: str, limit: int = 5) -> List[Dict]:
    """Get recent match results for a team."""
    sql = f"""
    SELECT match_id, league, match_date, home_team, away_team,
           home_score, away_score, result
    FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
    WHERE home_team = @team OR away_team = @team
    ORDER BY match_date DESC
    LIMIT {limit}
    """
    client = _get_bq_client()
    if not client:
        return []

    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[bq.ScalarQueryParameter("team", "STRING", team)]
    )
    try:
        results = client.query(sql, job_config=job_config).result()
        return [dict(r) for r in results]
    except Exception as e:
        logger.error(f"Recent matches query failed: {e}")
        return []


async def get_h2h_record(home: str, away: str, limit: int = 10) -> Dict:
    """Get head-to-head record between two teams."""
    sql = f"""
    SELECT result, COUNT(*) as cnt
    FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
    WHERE (home_team = @home AND away_team = @away)
       OR (home_team = @away AND away_team = @home)
    GROUP BY result
    ORDER BY cnt DESC
    """
    client = _get_bq_client()
    if not client:
        return {"home_wins": 0, "draws": 0, "away_wins": 0, "total": 0}

    from google.cloud import bigquery as bq
    job_config = bq.QueryJobConfig(
        query_parameters=[
            bq.ScalarQueryParameter("home", "STRING", home),
            bq.ScalarQueryParameter("away", "STRING", away),
        ]
    )
    try:
        results = client.query(sql, job_config=job_config).result()
        record = {"home_wins": 0, "draws": 0, "away_wins": 0, "total": 0}
        for r in results:
            result_type = r["result"]
            count = r["cnt"]
            if result_type == "HOME":
                record["home_wins"] = count
            elif result_type == "DRAW":
                record["draws"] = count
            elif result_type == "AWAY":
                record["away_wins"] = count
            record["total"] += count
        return record
    except Exception as e:
        logger.error(f"H2H query failed: {e}")
        return {"home_wins": 0, "draws": 0, "away_wins": 0, "total": 0}


async def get_prediction_accuracy(model_version: Optional[str] = None, days: int = 30) -> Dict:
    """Get prediction accuracy stats for a model version."""
    version_filter = f"AND model_version = '{model_version}'" if model_version else ""
    sql = f"""
    SELECT
        COUNT(*) as total,
        COUNTIF(correct = true) as correct_count,
        ROUND(AVG(log_loss), 4) as avg_log_loss,
        ROUND(COUNTIF(correct = true) / COUNT(*) * 100, 1) as accuracy_pct
    FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
    WHERE actual_result IS NOT NULL
      AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
      {version_filter}
    """
    results = await query(sql)
    if results:
        return results[0]
    return {"total": 0, "correct_count": 0, "avg_log_loss": 0, "accuracy_pct": 0}


async def log_prediction(match_id: str, model_version: str,
                          pred_home: float, pred_draw: float, pred_away: float,
                          recommendation: str, confidence: float) -> bool:
    """Log a prediction for later evaluation."""
    row = {
        "match_id": match_id,
        "model_version": model_version,
        "pred_home": pred_home,
        "pred_draw": pred_draw,
        "pred_away": pred_away,
        "recommendation": recommendation,
        "confidence": confidence,
        "predicted_at": datetime.now(timezone.utc).isoformat(),
    }
    return await insert_rows("predictions_log", [row])


async def log_feature_importance(model_version: str, features: Dict[str, float],
                                   prev_features: Optional[Dict[str, float]] = None) -> bool:
    """Log feature importance for a model version."""
    sorted_features = sorted(features.items(), key=lambda x: x[1], reverse=True)
    rows = []
    for rank, (feature, weight) in enumerate(sorted_features, 1):
        delta = 0.0
        if prev_features and feature in prev_features:
            delta = weight - prev_features[feature]
        rows.append({
            "model_version": model_version,
            "feature": feature,
            "weight": weight,
            "weight_delta": delta,
            "rank": rank,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        })
    return await insert_rows("feature_importance", rows)
