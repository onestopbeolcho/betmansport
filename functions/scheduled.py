"""
Scheduled Cloud Functions for Smart Proto Investor.
Uses @scheduler decorators for cron jobs.
"""
from firebase_functions import scheduler_fn, logger
import httpx


@scheduler_fn.on_schedule(
    schedule="0 */4 * * *",  # Every 4 hours
    timezone="Asia/Seoul",
    region="asia-northeast3",
)
def betman_crawler_job(event: scheduler_fn.ScheduledEvent) -> None:
    """
    베트맨 배당 크롤링 (5분마다 실행).
    내부 API 엔드포인트 `/api/admin/betman/crawl`을 호출하여 크롤링 실행.
    """
    try:
        # Call the internal API
        url = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api/api/admin/betman/crawl"
        response = httpx.post(url, timeout=300)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Betman crawl successful: {data.get('count', 0)} matches")
        else:
            logger.warning(f"⚠️ Betman crawl failed: {response.status_code} - {response.text[:200]}")
    
    except Exception as e:
        logger.error(f"❌ Betman crawler job error: {e}")
