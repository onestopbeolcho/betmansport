import os

file_path = "app/api/endpoints/scheduler.py"

content_to_append = """

@router.post("/cron/update-predictions")
async def cron_update_predictions(background_tasks: BackgroundTasks):
    \"\"\"
    주기적인 스케줄러 엔드포인트:
    1. 최신 배당 및 통계 수집
    2. 종목별 Feature Engineering
    3. In-memory LightGBM 모델 추론
    4. 결과를 Firestore의 `daily_portfolios`에 Batch Update 하여 읽기 비용 절감
    \"\"\"
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
            
            # Stats (placeholder for real DB fetch)
            stats_db = {} 
            
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
"""

with open(file_path, "a", encoding="utf-8") as f:
    f.write(content_to_append)

print("Appended /cron/update-predictions successfully.")
