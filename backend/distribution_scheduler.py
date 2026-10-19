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
from generate_shorts_pipeline import generate_video, build_script, fetch_top_matches, build_youtube_metadata, select_rotating_concept

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


async def run_distribution_pipeline(mode: str = "marketing", use_avatar: bool = False, langs: list = None):
    """
    한국어 유료 전환 퍼널 집중 — Broadcast Shorts v7.0 (5종 컨셉 자동 로테이션) 제작 및 유튜브 자동 배포 파이프라인
    """
    langs = ["ko"]
    logger.info(f"🚀 [Broadcast Shorts v7.0] 배포 파이프라인 트리거됨. 모드: {mode} (대상 언어: {langs})")

    load_config_to_env()

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_output")
    os.makedirs(output_dir, exist_ok=True)

    results = {}

    for lang in langs:
        matches = fetch_top_matches(limit=5, lang="ko")
        concept = select_rotating_concept(mode, matches)
        concept_id = concept.get("id", "QUANT_RADAR")
        meta = build_youtube_metadata(matches, concept=concept)

        logger.info(f"🎬 [{lang.upper()}] Broadcast Shorts v7.0 [{concept_id}] 빌드 및 배포 시작...")
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        video_path = os.path.join(output_dir, f"scorenix_shorts_{concept_id}_{lang}_{ts}.mp4")

        # 1. 숏폼 비디오 생성 (Broadcast Data Card v7.0 — 5종 컨셉 로테이션)
        try:
            loop = asyncio.get_running_loop()
            rendered_path = await loop.run_in_executor(
                None,
                generate_video,
                "background.mp4",
                video_path,
                False,
                use_avatar,
                mode,
                "ko",
                concept_id,
            )
        except Exception as render_err:
            logger.error(f"❌ [{lang.upper()}] 비디오 렌더링 중 오류 발생: {render_err}", exc_info=True)
            continue

        if not rendered_path or not os.path.exists(rendered_path):
            logger.error(f"❌ [{lang.upper()}] 비디오 파일이 성공적으로 생성되지 않았습니다.")
            continue

        logger.info(f"✅ [{lang.upper()}] 비디오 렌더링 완료: {rendered_path}")

        # 2. 유튜브 숏츠 자동 업로드
        logger.info(f"📤 [{lang.upper()}] 유튜브 숏츠 자동 업로드 시도 중...")
        youtube_url = None
        try:
            from app.services.youtube_uploader import upload_to_youtube
            youtube_vid = upload_to_youtube(
                rendered_path,
                meta["title"],
                meta["description"],
                meta["tags"],
            )
            if youtube_vid:
                youtube_url = f"https://youtube.com/shorts/{youtube_vid}"
                logger.info(f"✅ [{lang.upper()}] 유튜브 업로드 완료: {youtube_url}")
            else:
                logger.warning(f"⚠️ [{lang.upper()}] 유튜브 업로드 결과 비디오 ID를 받지 못했습니다.")
        except Exception as yt_err:
            logger.error(f"❌ [{lang.upper()}] 유튜브 업로드 실패: {yt_err}")

        results[lang] = {
            "youtube_url": youtube_url,
            "concept": concept_id,
            "voice": concept.get("voice"),
            "title": meta["title"],
            "free_match": f"{meta['free_match']['home']} vs {meta['free_match']['away']} ({meta['free_match']['pick_label']})",
        }

        # 3. 로컬 임시 파일 정리
        try:
            if os.path.exists(rendered_path):
                os.remove(rendered_path)
                logger.info(f"🗑️ [{lang.upper()}] 업로드 완료된 로컬 임시 비디오 파일이 정리되었습니다.")
        except OSError as clean_err:
            logger.warning(f"⚠️ [{lang.upper()}] 로컬 임시 비디오 정리 오류: {clean_err}")

    # 4. 텔레그램 알림 전송
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    ko_res = results.get("ko", {})
    yt_link = ko_res.get("youtube_url") or "업로드 대기/실패"
    alert_msg = (
        f"<b>🎬 스코어닉스 Broadcast Shorts v7.0 자동 발행 완료</b>\n"
        f"일시: {now_str}\n"
        f"컨셉 테마: <b>{ko_res.get('concept', 'QUANT_RADAR')} ({ko_res.get('voice', '-')})</b>\n"
        f"무료 샘플: <b>{ko_res.get('free_match', '-')}</b>\n"
        f"📺 유튜브 쇼츠: <a href=\"{yt_link}\">{yt_link}</a>\n"
        f"🌐 분석 페이지: https://scorenix.com/ko/analysis"
    )
    send_telegram_alert(alert_msg)

    return {"status": "success", "results": results}



if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scorenix Shorts Scheduler Script")
    parser.add_argument("--mode", type=str, default="top_picks", choices=["marketing", "winning", "educational", "top_picks"], help="제작할 숏폼 모드 지정")
    parser.add_argument("--avatar", action="store_true", help="D-ID AI 아바타 활성화 여부")
    args = parser.parse_args()
    
    asyncio.run(run_distribution_pipeline(args.mode, args.avatar))
