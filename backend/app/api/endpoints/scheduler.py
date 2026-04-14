"""
Scheduler API — automated odds collection and settlement.
Uses FastAPI BackgroundTasks to run periodic tasks.
Production: both Pinnacle (The Odds API) and Betman crawler triggers.
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import asyncio
from datetime import datetime, timezone

from app.services.pinnacle_api import pinnacle_service

router = APIRouter()
logger = logging.getLogger(__name__)


class SettleRequest(BaseModel):
    match_id: str
    winner: str  # "Home", "Draw", "Away"


class SettleResponse(BaseModel):
    match_id: str
    winner: str
    settled_count: int


# --- Betman state tracking ---
_betman_last_crawl: Optional[str] = None
_betman_last_count: int = 0
_betman_crawling: bool = False


@router.post("/collect_odds")
async def trigger_odds_collection(background_tasks: BackgroundTasks):
    """
    Manually trigger odds collection from The Odds API (Pinnacle replacement).
    Results are cached in Firestore for 5 minutes.
    """
    async def collect():
        try:
            odds = await pinnacle_service.refresh_odds()
            logger.info(f"Collected {len(odds)} odds items (force-fresh)")
        except Exception as e:
            logger.error(f"Collection failed: {e}")

    background_tasks.add_task(collect)
    return {
        "status": "Collection started",
        "source": "The Odds API (Pinnacle)",
        "api_key_present": bool(pinnacle_service.api_key),
        "requests_remaining": pinnacle_service._requests_remaining,
    }


@router.post("/collect_betman")
async def trigger_betman_collection(background_tasks: BackgroundTasks):
    """
    Manually trigger Betman crawler (프로토 승부식 배당 수집).
    Uses 3-tier strategy: Browser → HTTP JSON API → DB fallback.
    """
    global _betman_crawling, _betman_last_crawl, _betman_last_count

    if _betman_crawling:
        return {"status": "Already crawling", "last_crawl": _betman_last_crawl}

    def crawl():
        global _betman_crawling, _betman_last_crawl, _betman_last_count
        _betman_crawling = True
        try:
            from app.services.crawler_betman import BetmanCrawler
            crawler = BetmanCrawler()
            items = crawler.fetch_odds()
            _betman_last_count = len(items)
            _betman_last_crawl = datetime.now(timezone.utc).isoformat()
            logger.info(f"✅ Betman crawl complete: {len(items)} matches")
        except Exception as e:
            logger.error(f"Betman crawl failed: {e}")
        finally:
            _betman_crawling = False

    background_tasks.add_task(crawl)
    return {
        "status": "Betman crawl started",
        "last_crawl": _betman_last_crawl,
        "last_count": _betman_last_count,
    }


@router.post("/collect_all")
async def trigger_all_collection(background_tasks: BackgroundTasks):
    """
    Trigger both Pinnacle and Betman data collection simultaneously.
    Use this for full data refresh before round starts.
    """
    global _betman_crawling

    # Pinnacle (async)
    async def collect_pinnacle():
        try:
            odds = await pinnacle_service.refresh_odds()
            logger.info(f"Pinnacle: {len(odds)} items collected")
        except Exception as e:
            logger.error(f"Pinnacle collection failed: {e}")

    # Betman (sync in executor)
    def collect_betman():
        global _betman_crawling, _betman_last_crawl, _betman_last_count
        if _betman_crawling:
            return
        _betman_crawling = True
        try:
            from app.services.crawler_betman import BetmanCrawler
            crawler = BetmanCrawler()
            items = crawler.fetch_odds()
            _betman_last_count = len(items)
            _betman_last_crawl = datetime.now(timezone.utc).isoformat()
            logger.info(f"Betman: {len(items)} matches collected")
        except Exception as e:
            logger.error(f"Betman collection failed: {e}")
        finally:
            _betman_crawling = False

    background_tasks.add_task(collect_pinnacle)
    background_tasks.add_task(collect_betman)

    return {
        "status": "Full collection started (Pinnacle + Betman)",
        "pinnacle_api_key": bool(pinnacle_service.api_key),
        "betman_crawling": _betman_crawling,
    }


@router.post("/settle", response_model=SettleResponse)
async def trigger_settlement(req: SettleRequest):
    """
    Manually settle a match — grade all predictions.
    In production, this would be triggered by a webhook or scheduled check.
    """
    from app.services.settlement import settle_match

    if req.winner not in ("Home", "Draw", "Away"):
        raise HTTPException(status_code=400, detail="Winner must be Home, Draw, or Away")

    count = await settle_match(req.match_id, req.winner)
    return SettleResponse(
        match_id=req.match_id,
        winner=req.winner,
        settled_count=count,
    )


_settle_last_run: Optional[str] = None
_settle_last_result: Optional[dict] = None


@router.post("/auto_settle")
async def auto_settle_results(background_tasks: BackgroundTasks):
    """
    Manually trigger auto-settlement of all pending betting slips.
    Also runs automatically via Firebase Cloud Scheduler every 6 hours.
    (00:00, 06:00, 12:00, 18:00 KST)
    """
    global _settle_last_run, _settle_last_result

    async def settle():
        global _settle_last_run, _settle_last_result
        try:
            from app.services.settlement import auto_settle_slips
            result = await auto_settle_slips()
            _settle_last_run = datetime.now(timezone.utc).isoformat()
            _settle_last_result = result
            logger.info(f"Auto-settlement result: {result}")
        except Exception as e:
            logger.error(f"Auto-settlement failed: {e}")

    background_tasks.add_task(settle)
    return {
        "status": "Auto-settlement started",
        "message": "Checking all PENDING slips against latest scores",
        "schedule": "Every 6 hours (00:00, 06:00, 12:00, 18:00 KST)",
        "last_run": _settle_last_run,
    }


@router.get("/status")
async def get_scheduler_status():
    """Get current status of all data sources, scheduler, settlement, and ML."""
    # Try to get last scheduled run from Firestore
    last_scheduled_run = None
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        doc = db.collection("system_logs").document("auto_settle_last_run").get()
        if doc.exists:
            data = doc.to_dict()
            last_scheduled_run = {
                "timestamp": data.get("timestamp", "").isoformat() if hasattr(data.get("timestamp", ""), "isoformat") else str(data.get("timestamp", "")),
                "result": data.get("result"),
                "trigger": data.get("trigger", "unknown"),
            }
    except Exception:
        pass

    # ML model status
    ml_status = {"engine": "fallback", "model_loaded": False}
    try:
        from app.core.ml_predictor import ml_predictor
        ml_status = {
            "engine": "lightgbm" if ml_predictor.is_ml_ready else "fallback",
            "model_loaded": ml_predictor.is_ml_ready,
        }
    except Exception:
        pass

    return {
        "pinnacle": {
            "api_key_configured": bool(pinnacle_service.api_key),
            "requests_remaining": pinnacle_service._requests_remaining,
            "requests_used": pinnacle_service._requests_used,
            "target_sports": pinnacle_service.target_sports,
        },
        "betman": {
            "last_crawl": _betman_last_crawl,
            "last_match_count": _betman_last_count,
            "currently_crawling": _betman_crawling,
        },
        "settlement": {
            "schedule": "Every 6 hours (00:00, 06:00, 12:00, 18:00 KST)",
            "manual_last_run": _settle_last_run,
            "manual_last_result": _settle_last_result,
            "scheduled_last_run": last_scheduled_run,
        },
        "ml_engine": ml_status,
    }


# ─── Phase 3: Nightly Self-Learning Pipeline ───

_nightly_last_run: Optional[str] = None
_nightly_last_result: Optional[dict] = None
_nightly_running: bool = False


@router.post("/nightly_retrain")
async def trigger_nightly_retrain(background_tasks: BackgroundTasks):
    """
    Nightly self-learning pipeline (매일 새벽 03:00 KST).
    Cloud Scheduler: 0 18 * * * UTC (= 03:00 KST)
    Step 1: 어제 경기 결과 수집 → 예측과 비교
    Step 2: Loss 계산 → 오답 분석
    Step 3: LightGBM Incremental Retraining
    """
    global _nightly_running, _nightly_last_run, _nightly_last_result

    if _nightly_running:
        return {"status": "Already running", "last_run": _nightly_last_run}

    async def run_pipeline():
        global _nightly_running, _nightly_last_run, _nightly_last_result
        _nightly_running = True
        try:
            from app.services.self_learning import self_learning_pipeline
            result = await self_learning_pipeline.run_nightly()
            _nightly_last_run = datetime.now(timezone.utc).isoformat()
            _nightly_last_result = result

            # Reload ML model in predictor after retraining
            if result.get("model_updated"):
                try:
                    from app.core.ml_predictor import ml_predictor
                    ml_predictor.reload_model()
                    logger.info("✅ ML model reloaded after nightly retraining")
                except Exception as e:
                    logger.warning(f"Model reload after retrain failed: {e}")

            # Generate VIP error note report via Gemini
            error_note = result.get("error_note")
            if error_note and error_note.get("big_misses"):
                try:
                    from app.services.gemini_service import generate_error_note_report
                    report = await generate_error_note_report(error_note)
                    if report:
                        # Save to Firestore for frontend
                        from app.db.firestore import get_firestore_db
                        db = get_firestore_db()
                        db.collection("vip_alerts").document(
                            f"error_note_{error_note['date']}"
                        ).set({
                            "type": "error_note",
                            "date": error_note["date"],
                            "report_markdown": report,
                            "accuracy_pct": error_note["summary"]["accuracy_pct"],
                            "created_at": datetime.now(timezone.utc),
                        })
                        logger.info("✅ VIP error note report saved to Firestore")
                except Exception as e:
                    logger.warning(f"Error note report generation failed: {e}")

            logger.info(f"✅ Nightly pipeline complete: {result}")
        except Exception as e:
            logger.error(f"Nightly pipeline failed: {e}")
            _nightly_last_result = {"status": "error", "error": str(e)}
        finally:
            _nightly_running = False

    background_tasks.add_task(run_pipeline)
    return {
        "status": "Nightly retraining started",
        "schedule": "Daily 03:00 KST (Cloud Scheduler)",
        "last_run": _nightly_last_run,
    }


@router.get("/ml_status")
async def get_ml_status():
    """Get ML model status and recent prediction accuracy."""
    from app.core.ml_predictor import ml_predictor
    from app.services import bigquery_service as bq_svc

    accuracy = await bq_svc.get_prediction_accuracy(days=30)

    return {
        "engine": "lightgbm" if ml_predictor.is_ml_ready else "fallback",
        "model_loaded": ml_predictor.is_ml_ready,
        "feature_importance": ml_predictor.get_feature_importance(),
        "accuracy_30d": accuracy,
        "nightly_pipeline": {
            "last_run": _nightly_last_run,
            "last_result": _nightly_last_result,
            "currently_running": _nightly_running,
        },
    }


@router.post("/reload_model")
async def reload_ml_model():
    """Force reload the ML model from GCS/local storage."""
    from app.core.ml_predictor import ml_predictor
    success = ml_predictor.reload_model()
    return {
        "status": "reloaded" if success else "fallback",
        "ml_ready": success,
    }


# ─── Historical Data Backfill ───

_backfill_running: bool = False
_backfill_result: Optional[dict] = None


@router.post("/backfill_historical")
async def trigger_backfill(background_tasks: BackgroundTasks):
    """
    과거 시즌 경기 결과 + 배당률을 BigQuery에 소급 수집.
    API-Football 무료 100건/일 → 리그 수에 따라 여러 회 실행.
    """
    global _backfill_running, _backfill_result

    if _backfill_running:
        return {"status": "Already running", "last_result": _backfill_result}

    async def run_backfill():
        global _backfill_running, _backfill_result
        _backfill_running = True
        try:
            from app.services.backfill import backfill_engine
            result = await backfill_engine.run_full_backfill(
                seasons=[2022, 2023, 2024],  # API-Football free tier: 2022-2024
                leagues=None,  # all leagues
            )
            _backfill_result = result
            logger.info(f"✅ Backfill complete: {result.get('total_matches_collected', 0)} matches")
        except Exception as e:
            logger.error(f"Backfill failed: {e}")
            _backfill_result = {"status": "error", "error": str(e)}
        finally:
            _backfill_running = False

    background_tasks.add_task(run_backfill)
    return {
        "status": "Backfill started (2022-2024 seasons, all leagues)",
        "note": "API-Football free tier: 100 req/day. May need multiple runs.",
    }


@router.get("/backfill_status")
async def get_backfill_status():
    """Get current backfill status."""
    return {
        "running": _backfill_running,
        "last_result": _backfill_result,
    }


@router.post("/initial_train")
async def trigger_initial_training():
    """
    BigQuery에 적재된 과거 데이터로 LightGBM 첫 학습 실행.
    backfill_historical 완료 후 실행.
    NOTE: 동기 실행 — Cloud Run background task는 HTTP 응답 후 kill됨.
    """
    try:
        import numpy as np
        import lightgbm as lgb
        from sklearn.preprocessing import LabelEncoder
        from app.services import bigquery_service as bq
        from app.services.feature_store import get_feature_names
        from app.core.model_store import save_model

        logger.info("🎓 Starting initial ML model training...")

        # 1. Load all completed matches from BigQuery (no odds needed)
        sql = f"""
        SELECT match_id, home_team, away_team, league, season,
               result, home_score, away_score, match_date, venue, round
        FROM `{bq.PROJECT_ID}.{bq.DATASET_ID}.matches_raw`
        WHERE result IS NOT NULL
          AND result != ''
          AND result IN ('HOME', 'AWAY', 'DRAW')
        ORDER BY match_date ASC
        """
        data = await bq.query(sql)
        if not data or len(data) < 50:
            logger.warning(f"Insufficient training data: {len(data) if data else 0} rows (need 50+)")
            return {"status": "error", "error": f"Insufficient data: {len(data) if data else 0} rows"}

        logger.info(f"  📊 Loaded {len(data)} matches from BigQuery")

        # 2. Build team stats lookups from the data itself
        from collections import defaultdict
        team_matches = defaultdict(list)

        for row in data:
            home = row["home_team"]
            away = row["away_team"]
            date = row.get("match_date", "")
            hs = int(row.get("home_score", 0) or 0)
            as_ = int(row.get("away_score", 0) or 0)
            result = row["result"]

            team_matches[home].append({
                "date": date, "result": result, "is_home": True,
                "goals_for": hs, "goals_against": as_, "opponent": away,
            })
            team_matches[away].append({
                "date": date,
                "result": "AWAY" if result == "HOME" else ("HOME" if result == "AWAY" else "DRAW"),
                "is_home": False,
                "goals_for": as_, "goals_against": hs, "opponent": home,
            })

        # 3. Build feature vectors using match history
        feature_names = get_feature_names()
        X_list = []
        y_list = []
        skipped = 0

        for i, row in enumerate(data):
            home = row["home_team"]
            away = row["away_team"]

            # Get matches before this one for both teams
            home_prev = [m for m in team_matches[home] if m["date"] < row.get("match_date", "")][-10:]
            away_prev = [m for m in team_matches[away] if m["date"] < row.get("match_date", "")][-10:]

            # Need at least 3 previous matches for each team
            if len(home_prev) < 3 or len(away_prev) < 3:
                skipped += 1
                continue

            # Compute features from match history
            features = {}

            # Win rates (last 5)
            h5 = home_prev[-5:]
            a5 = away_prev[-5:]
            features["home_win_rate_last5"] = sum(1 for m in h5 if m["result"] == "HOME") / max(len(h5), 1)
            features["away_win_rate_last5"] = sum(1 for m in a5 if m["result"] == "HOME") / max(len(a5), 1)
            features["home_draw_rate_last5"] = sum(1 for m in h5 if m["result"] == "DRAW") / max(len(h5), 1)
            features["away_draw_rate_last5"] = sum(1 for m in a5 if m["result"] == "DRAW") / max(len(a5), 1)

            # Rest days (simplified)
            features["home_rest_days"] = 3.0
            features["away_rest_days"] = 3.0

            # H2H
            h2h_matches = [m for m in home_prev if m["opponent"] == away]
            if h2h_matches:
                features["h2h_home_win_rate"] = sum(1 for m in h2h_matches if m["result"] == "HOME") / len(h2h_matches)
                features["h2h_draw_rate"] = sum(1 for m in h2h_matches if m["result"] == "DRAW") / len(h2h_matches)
                features["h2h_total_matches"] = float(len(h2h_matches))
            else:
                features["h2h_home_win_rate"] = 0.5
                features["h2h_draw_rate"] = 0.2
                features["h2h_total_matches"] = 0.0

            # Rank (use win rate as proxy)
            features["home_rank"] = 10.0
            features["away_rank"] = 10.0
            features["rank_diff"] = 0.0

            # Goals averages
            features["home_goals_for_avg"] = sum(m["goals_for"] for m in home_prev[-5:]) / max(len(home_prev[-5:]), 1)
            features["home_goals_against_avg"] = sum(m["goals_against"] for m in home_prev[-5:]) / max(len(home_prev[-5:]), 1)
            features["away_goals_for_avg"] = sum(m["goals_for"] for m in away_prev[-5:]) / max(len(away_prev[-5:]), 1)
            features["away_goals_against_avg"] = sum(m["goals_against"] for m in away_prev[-5:]) / max(len(away_prev[-5:]), 1)

            # Venue performance
            home_at_home = [m for m in home_prev if m["is_home"]]
            away_at_away = [m for m in away_prev if not m["is_home"]]
            features["home_team_home_win_rate"] = sum(1 for m in home_at_home if m["result"] == "HOME") / max(len(home_at_home), 1)
            features["away_team_away_win_rate"] = sum(1 for m in away_at_away if m["result"] == "HOME") / max(len(away_at_away), 1)

            # Points
            features["home_points"] = float(sum(3 if m["result"] == "HOME" else (1 if m["result"] == "DRAW" else 0) for m in home_prev))
            features["away_points"] = float(sum(3 if m["result"] == "HOME" else (1 if m["result"] == "DRAW" else 0) for m in away_prev))
            features["points_diff"] = features["home_points"] - features["away_points"]

            # Odds (none available, use neutral)
            features["implied_prob_home"] = 0.4
            features["implied_prob_draw"] = 0.25
            features["implied_prob_away"] = 0.35
            features["odds_margin"] = 0.05

            # Injuries (none available)
            features["missing_key_players_home"] = 0.0
            features["missing_key_players_away"] = 0.0
            features["injury_diff"] = 0.0

            # Stage 1: 골득실 차이
            gf_h = features.get("home_goals_for_avg", 1.2)
            ga_h = features.get("home_goals_against_avg", 1.2)
            gf_a = features.get("away_goals_for_avg", 1.2)
            ga_a = features.get("away_goals_against_avg", 1.2)
            features["goal_diff_home"] = gf_h - ga_h
            features["goal_diff_away"] = gf_a - ga_a
            features["goal_diff_gap"] = (gf_h - ga_h) - (gf_a - ga_a)

            # Stage 1: API 외부 예측 (과거 데이터 없으므로 중립값)
            features["api_pred_home"] = 0.33
            features["api_pred_draw"] = 0.33
            features["api_pred_away"] = 0.33

            # Stage 1: 리그별 홈 어드밴티지
            league_key = row.get("league", "")
            LEAGUE_HOME_ADV = {
                "soccer_epl": 1.05, "soccer_spain_la_liga": 1.12,
                "soccer_germany_bundesliga": 1.08, "soccer_italy_serie_a": 1.10,
                "soccer_france_ligue_one": 1.06, "soccer_turkey_super_lig": 1.25,
                "soccer_korea_kleague": 1.06, "soccer_japan_jleague": 1.02,
                "soccer_usa_mls": 1.08, "soccer_brazil_serie_a": 1.15,
            }
            features["league_home_adv"] = LEAGUE_HOME_ADV.get(league_key, 1.05)

            # Stage 2: 모멘텀 (폼 가속도)
            features["momentum_home"] = features.get("home_win_rate_last5", 0.5) - 0.5
            features["momentum_away"] = features.get("away_win_rate_last5", 0.5) - 0.5

            # Stage 2: H2H 최근성 점수
            import math
            h2h_wr = features.get("h2h_home_win_rate", 0.5)
            h2h_total = features.get("h2h_total_matches", 0)
            recency_conf = min(math.log(h2h_total + 1) / math.log(11), 1.0)
            features["h2h_recency_score"] = h2h_wr * recency_conf

            # Stage 2: 부상 품질 점수
            features["injury_quality_home"] = features.get("missing_key_players_home", 0) * 7.0
            features["injury_quality_away"] = features.get("missing_key_players_away", 0) * 7.0

            # Build row in correct order
            X_row = [features.get(f, 0.0) for f in feature_names]
            X_list.append(X_row)
            y_list.append(row["result"])

        logger.info(f"  Built features for {len(X_list)} matches (skipped {skipped} with insufficient history)")

        if len(X_list) < 50:
            logger.warning(f"Too few training samples: {len(X_list)}")
            return {"status": "error", "error": f"Too few samples: {len(X_list)}"}

        X = np.array(X_list, dtype=np.float32)
        le = LabelEncoder()
        y = le.fit_transform(y_list)

        logger.info(f"  Feature matrix: {X.shape}, Classes: {le.classes_}")
        logger.info(f"  Class distribution: {dict(zip(le.classes_, [int((y==i).sum()) for i in range(len(le.classes_))]))}")

        # 4. Train LightGBM
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

        model = lgb.train(params, train_data, num_boost_round=200)
        logger.info("  ✅ LightGBM model trained successfully")

        # 5. Save model
        version = "initial_v1"
        path = save_model(model, "lightgbm_predictor", version)
        logger.info(f"  ✅ Model saved: {path}")

        # 6. Log feature importances
        importances = {
            name: float(imp)
            for name, imp in zip(feature_names, model.feature_importance())
        }
        top_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:5]
        logger.info(f"  🔑 Top features: {top_features}")

        try:
            await bq.log_feature_importance(f"v{version}", importances, {})
        except Exception as e:
            logger.warning(f"Feature importance logging failed: {e}")

        # 7. Reload in predictor
        from app.core.ml_predictor import ml_predictor
        ml_predictor.reload_model()
        logger.info(f"  ✅ ML predictor reloaded. is_ml_ready={ml_predictor.is_ml_ready}")

    except Exception as e:
        logger.error(f"❌ Initial training failed: {e}", exc_info=True)
        return {"status": "error", "error": str(e)}

    return {
        "status": "Training completed successfully",
        "matches_used": len(X_list),
        "model_path": path,
        "ml_ready": ml_predictor.is_ml_ready,
    }


@router.post("/cron/update-predictions")
async def cron_update_predictions(background_tasks: BackgroundTasks):
    """
    주기적인 스케줄러 엔드포인트:
    1. 최신 배당 및 통계 수집
    2. 종목별 Feature Engineering
    3. In-memory LightGBM 모델 추론
    4. 결과를 Firestore의 `daily_portfolios`에 Batch Update 하여 읽기 비용 절감
    """
    async def update_job():
        try:
            logger.info("Starting scheduled prediction update...")
            from app.services.pinnacle_api import pinnacle_service
            from app.services.ml_service import ml_inference_service
            from app.db.firestore import get_firestore_db
            from datetime import datetime, timezone
            
            # 1. Fetch latest matches
            matches = await pinnacle_service.refresh_odds()
            matches_dict = [m.model_dump() if hasattr(m, 'model_dump') else m.__dict__ for m in matches]
            
            # Separate by sports
            soccer_matches = [m for m in matches_dict if m.get("sport", "").lower() == "soccer"]
            baseball_matches = [m for m in matches_dict if m.get("sport", "").lower() == "baseball"]
            
            logger.info(f"Fetched {len(soccer_matches)} soccer and {len(baseball_matches)} baseball matches.")
            
            # 2. Fetch soccer specific advanced stats
            from app.services.soccer_stats_service import soccer_stats_service
            
            soccer_teams = set()
            for m in soccer_matches:
                if m.get("team_home"): soccer_teams.add(m.get("team_home"))
                if m.get("team_away"): soccer_teams.add(m.get("team_away"))
                
            stats_db = soccer_stats_service.fetch_team_stats(list(soccer_teams))            
            # 2 & 3. Feature Engineering & Predict
            soccer_preds = ml_inference_service.predict_matches("soccer", soccer_matches, stats_db)
            baseball_preds = ml_inference_service.predict_matches("baseball", baseball_matches, stats_db)
            
            all_preds = soccer_preds + baseball_preds
            
            # 4. Batch update to Firestore daily_portfolios
            if all_preds:
                db = get_firestore_db()
                today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                doc_ref = db.collection("daily_portfolios").document(today_str)
                
                # Append or set predictions
                doc_ref.set({
                    "date": today_str,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "matches": all_preds
                }, merge=True)
                
                logger.info(f"Updated daily_portfolios for {today_str} with {len(all_preds)} matches.")
                
        except Exception as e:
            logger.error(f"Scheduled prediction update failed: {e}")

    background_tasks.add_task(update_job)
    return {"status": "Update job triggered in background"}
