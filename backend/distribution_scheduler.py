"""
Scorenix Shorts Distribution Scheduler
======================================
1. 지정한 모드로 하이브리드 쇼츠 영상을 제작합니다.
2. 유튜브 숏츠에 영상을 자동으로 업로드합니다.
3. 구글 드라이브 지정 공유 폴더로 자동 동기화(업로드)합니다.
4. 등록된 텔레그램(Telegram) 채널/봇으로 업로드 완료 알림 및 릴스/틱톡 수동 복사용 제목 & 태그 텍스트를 발송합니다.
"""
import os
import sys
import asyncio
import logging
from datetime import datetime, timezone
import requests

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.config_db import load_config_to_env
from app.services.google_drive_service import google_drive_service
from generate_shorts_pipeline import generate_video, build_script, fetch_top_matches

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DistributionScheduler")


def send_telegram_alert(message: str) -> bool:
    """텔레그램 봇으로 알림 메시지 전송"""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()

    if not token or not chat_id:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 설정되지 않아 알림을 건너뜁니다.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": False
    }

    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code == 200:
            logger.info("✅ 텔레그램 알림 발송 성공")
            return True
        else:
            logger.error(f"❌ 텔레그램 알림 발송 실패 (상태 코드: {resp.status_code}): {resp.text}")
            return False
    except Exception as e:
        logger.error(f"❌ 텔레그램 알림 예외 발생: {e}")
        return False


async def run_distribution_pipeline(mode: str, use_avatar: bool = False):
    """
    하이브리드 비디오 제작 및 플랫폼별 배포 자동화 파이프라인 실행
    """
    logger.info(f"🚀 배포 파이프라인 트리거됨. 모드: {mode} (아바타 활성: {use_avatar})")
    
    # 0. 환경변수 최신화 (Firestore 로딩)
    load_config_to_env()
    
    # 임시 출력 파일 경로 설정
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_output")
    os.makedirs(output_dir, exist_ok=True)
    video_path = os.path.join(output_dir, f"scorenix_shorts_{mode}_{ts}.mp4")
    
    # 1. 숏폼 비디오 생성 (인트로/아웃트로 D-ID 아바타 + 본문 7-Factor 카드 화면)
    logger.info("🎥 하이브리드 숏폼 비디오 렌더링 시작...")
    try:
        # generate_shorts_pipeline 모듈의 비디오 제작 함수 비동기/동기 호출
        # generate_video는 내부적으로 ffmpeg 및 moviepy를 사용하여 동기적으로 차례차례 빌드합니다.
        loop = asyncio.get_running_loop()
        # ThreadPoolExecutor를 사용하여 CPU/디스크 집약적인 moviepy 렌더링이 비동기 루프를 막지 않도록 실행
        rendered_path = await loop.run_in_executor(
            None, 
            generate_video, 
            "background.mp4", 
            video_path, 
            False,      # auto_upload는 본 스케줄러에서 따로 관리하므로 False
            use_avatar, 
            mode
        )
    except Exception as render_err:
        logger.error(f"❌ 비디오 렌더링 중 오류 발생: {render_err}", exc_info=True)
        return {"status": "failed", "reason": f"Rendering error: {render_err}"}

    if not rendered_path or not os.path.exists(rendered_path):
        logger.error("❌ 비디오 파일이 성공적으로 생성되지 않았습니다.")
        return {"status": "failed", "reason": "Video file not found after rendering"}

    logger.info(f"✅ 비디오 렌더링 완료: {rendered_path}")

    # 2. 유튜브 숏츠 자동 업로드
    logger.info("📤 유튜브 숏츠(YouTube Shorts) 자동 업로드 시도 중...")
    youtube_url = None
    try:
        from app.services.youtube_uploader import upload_to_youtube
        now = datetime.now()
        
        # 제목 및 캡션 빌드
        title = f"[AI 예측] {now.strftime('%m/%d')} 데이터가 말하는 오늘의 경기 #shorts"
        description = (
            f"✦ {now.strftime('%Y년 %m월 %d일')} 기준 AI 데이터 분석\n\n"
            "7-Factor AI 알고리즘으로 분석한 기대값 리포트입니다.\n"
            "※ 본 영상은 데이터 분석 결과이며 투자 권유가 아닙니다.\n\n"
            "👉 전체 분석 리포트 확인: https://scorenix.com\n\n"
            "#스포츠분석 #AI분석 #배당분석 #데이터분석 #shorts"
        )
        tags = ["스포츠분석", "AI분석", "배당분석", "데이터분석", "shorts", "스코어닉스"]
        
        youtube_vid = upload_to_youtube(rendered_path, title, description, tags)
        if youtube_vid:
            youtube_url = f"https://youtu.be/{youtube_vid}"
            logger.info(f"✅ 유튜브 업로드 완료: {youtube_url}")
        else:
            logger.warning("⚠️ 유튜브 업로드 결과 비디오 ID를 받지 못했습니다.")
    except Exception as yt_err:
        logger.error(f"❌ 유튜브 업로드 실패: {yt_err}")

    # 3. 구글 드라이브(Google Drive) 공유 폴더로 업로드 연동
    logger.info("📂 인스타그램/틱톡 배포용 구글 드라이브 백업 업로드 시작...")
    drive_link = None
    try:
        if google_drive_service.is_configured:
            drive_link = google_drive_service.upload_video(rendered_path)
            if drive_link:
                logger.info(f"✅ 구글 드라이브 업로드 성공. 링크: {drive_link}")
            else:
                logger.warning("⚠️ 구글 드라이브 업로드 결과 링크를 받지 못했습니다.")
        else:
            logger.warning("⚠️ 구글 드라이브 서비스가 비활성화 상태입니다. 서비스 계정 JSON 설정을 확인해 주세요.")
    except Exception as drive_err:
        logger.error(f"❌ 구글 드라이브 업로드 중 오류 발생: {drive_err}")

    # 4. 인스타그램 릴스 & 틱톡 복사용 텔레그램 채널 알림 전송
    logger.info("📲 모바일 수동 배포 지원을 위한 텔레그램 알림 생성 중...")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    # 알림 메시지 템플릿
    alert_msg = f"""<b>🎬 스코어닉스 AI 숏폼 제작 완료 ({mode.upper()})</b>
일시: {now_str}

<b>📲 인스타그램 릴스 및 틱톡 복사용 메타데이터</b>
--------------------------------------------
<b>[제목 추천]</b>
오늘 밤 AI 승리 예측 경기 TOP 3! ⚡

<b>[본문 캡션 & 해시태그]</b>
🧠 스코어닉스 7-Factor AI 알고리즘 분석 완료!
Pinnacle 해외 배당판과 국내 배당 효율성을 완벽히 교차 검증한 기대값(EV) 분석 리포트입니다.

👉 프로필 링크를 눌러 실시간 분석 카드를 무료로 확인하세요!

#스코어닉스 #AI분석 #스포츠데이터 #가치투자 #오늘의경기 #릴스 #Reels #TikTok
--------------------------------------------

<b>🔗 다운로드 및 퍼블릭 링크</b>
📁 <a href="{drive_link or '#'}">구글 드라이브에서 비디오 다운로드</a>
📺 <a href="{youtube_url or '#'}">유튜브 숏츠 바로가기</a>
"""
    
    send_telegram_alert(alert_msg)
    
    # 5. 로컬 영상 임시 보관 (클라우드 배포 시 파일 시스템 부족 방지를 위해 업로드 완료 후 로컬 파일 정리)
    try:
        if os.path.exists(rendered_path):
            os.remove(rendered_path)
            logger.info("🗑️ 업로드 완료된 로컬 임시 비디오 파일이 정리되었습니다.")
    except OSError as clean_err:
        logger.warning(f"⚠️ 로컬 임시 비디오 정리 오류: {clean_err}")

    return {
        "status": "success",
        "mode": mode,
        "youtube_url": youtube_url,
        "google_drive_link": drive_link
    }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scorenix Shorts Scheduler Script")
    parser.add_argument("--mode", type=str, default="top_picks", choices=["marketing", "winning", "educational", "top_picks"], help="제작할 숏폼 모드 지정")
    parser.add_argument("--avatar", action="store_true", help="D-ID AI 아바타 활성화 여부")
    args = parser.parse_args()
    
    asyncio.run(run_distribution_pipeline(args.mode, args.avatar))
