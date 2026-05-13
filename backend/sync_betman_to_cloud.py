"""
Scorenix Betman Sync Tool
- 로컬 PC(한국 IP)에서 브라우저 크롤링을 수행
- 결과를 구글 Firestore(Cloud)에 직접 업로드
- 서버(Cloud Run)는 IP 차단 걱정 없이 DB에서 배당 데이터를 읽음
"""
import os
import sys
import logging
import asyncio
from datetime import datetime, timezone

# 프로젝트 루트 경로 추가 (app 모듈 임포트용)
sys.path.append(os.getcwd())

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('betman_sync.log', encoding='utf-8')
    ]
)
logger = logging.getLogger("betman_sync")

def run_sync():
    logger.info("==============================================")
    logger.info("🚀 Scorenix Betman Cloud Sync Started")
    logger.info("==============================================")
    
    try:
        from app.services.crawler_betman_browser import crawl_betman_via_browser
        from app.models.betman_db import save_betman_round
        
        # 1. 크롤링 수행 (Playwright)
        logger.info("🌐 [1/2] Betman 브라우저 크롤링 중 (Playwright, Headless=False)...")
        result = crawl_betman_via_browser(headless=False)
        
        if not result["success"]:
            logger.error(f"❌ 크롤링 실패: {result['error']}")
            return False
            
        matches = result["matches"]
        round_id = result["round_id"]
        
        if not matches:
            logger.warning("⚠️ 검색된 경기가 없습니다. (회차 교체 시기일 수 있음)")
            return True
            
        logger.info(f"✅ [2/2] {len(matches)}개 경기 데이터 확보 (회차: {round_id})")
        
        # 2. Firestore 업로드
        logger.info("📤 Cloud Firestore 업로드 중...")
        # save_betman_round 내부에서 Firestore와 로컬 JSON 모두 저장함
        count = save_betman_round(str(round_id), matches)
        
        logger.info(f"🎉 성공! {count}개 경기가 클라우드 DB에 동기화되었습니다.")
        logger.info(f"⏰ 동기화 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True
        
    except Exception as e:
        logger.error(f"🔥 예기치 못한 오류 발생: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    import time
    
    # 명령줄 인자로 --loop가 있으면 무한 반복
    is_loop = "--loop" in sys.argv
    
    while True:
        success = run_sync()
        
        if not is_loop:
            if not success:
                sys.exit(1)
            break
            
        logger.info("⏳ 30분 후 다음 동기화를 진행합니다. (프로그램을 끄지 마세요)")
        time.sleep(30 * 60) # 30분 대기
