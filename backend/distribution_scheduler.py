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


async def run_distribution_pipeline(mode: str, use_avatar: bool = False, langs: list = None):
    """
    하이브리드 비디오 제작 및 플랫폼별 배포 자동화 파이프라인 실행 (다국어 일괄 또는 개별 처리)
    """
    logger.info(f"🚀 배포 파이프라인 트리거됨. 모드: {mode} (아바타 활성: {use_avatar}, 대상 언어: {langs})")
    
    # 0. 환경변수 최신화 (Firestore 로딩)
    load_config_to_env()
    
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "video_output")
    os.makedirs(output_dir, exist_ok=True)
    
    if langs is None:
        langs = ["ko", "en", "ja"]
        
    results = {}
    
    for lang in langs:
        logger.info(f"🌐 [{lang.upper()}] 다국어 숏츠 빌드 및 배포 시작...")
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        video_path = os.path.join(output_dir, f"scorenix_shorts_{mode}_{lang}_{ts}.mp4")
        
        # 1. 숏폼 비디오 생성 (Gemini 번역 및 성우 튜닝 탑재)
        try:
            loop = asyncio.get_running_loop()
            rendered_path = await loop.run_in_executor(
                None, 
                generate_video, 
                "background.mp4", 
                video_path, 
                False,      # auto_upload는 본 스케줄러에서 따로 관리하므로 False
                use_avatar, 
                mode,
                lang
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
            now = datetime.now()
            
            # 제목 및 캡션 다국어 템플릿
            title_templates = {
                "ko": f"[AI 예측] {now.strftime('%m/%d')} 데이터가 말하는 오늘의 경기 #shorts",
                "en": f"[AI Predict] {now.strftime('%m/%d')} Today's Match Predictions by Data #shorts",
                "ja": f"[AI予測] {now.strftime('%m/%d')} データが語る今日の勝敗予想 #shorts"
            }
            title = title_templates.get(lang, title_templates["ko"])
            
            description_templates = {
                "ko": (
                    f"✦ {now.strftime('%Y년 %m월 %d일')} 기준 AI 데이터 분석\n\n"
                    "7-Factor AI 알고리즘으로 분석한 기대값 리포트입니다.\n"
                    "※ 본 영상은 데이터 분석 결과이며 투자 권유가 아닙니다.\n\n"
                    "👉 전체 분석 리포트 확인: https://scorenix.com\n\n"
                    "#스포츠분석 #AI분석 #배당분석 #데이터분석 #shorts"
                ),
                "en": (
                    f"✦ AI Data Analysis as of {now.strftime('%b %d, %Y')}\n\n"
                    "Expectation value report analyzed by 7-Factor AI algorithm.\n"
                    "* This video is a data analysis result and is not an investment recommendation.\n\n"
                    "👉 Check all analysis reports: https://scorenix.com\n\n"
                    "#sportsanalytics #AIprediction #oddsanalysis #dataanalysis #shorts"
                ),
                "ja": (
                    f"✦ {now.strftime('%Y年%m月%d日')} 基準 AIデータ分析\n\n"
                    "7-Factor AIアルゴリズムで分析した期待値レポートです。\n"
                    "※ 本動画はデータ分析結果であり、投資勧誘ではありません。\n\n"
                    "👉 全分析レポートを確認: https://scorenix.com\n\n"
                    "#スポーツ分析 #AI分析 #配当分析 #データ分析 #shorts"
                )
            }
            description = description_templates.get(lang, description_templates["ko"])
            
            tags_map = {
                "ko": ["스포츠분석", "AI분석", "배당분석", "데이터분석", "shorts", "스코어닉스"],
                "en": ["sportsanalytics", "AIprediction", "oddsanalysis", "dataanalysis", "shorts", "scorenix"],
                "ja": ["スポーツ分析", "AI分析", "配当分析", "データ分析", "shorts", "スコアニック"]
            }
            tags = tags_map.get(lang, tags_map["ko"])
            
            youtube_vid = upload_to_youtube(rendered_path, title, description, tags)
            if youtube_vid:
                youtube_url = f"https://youtu.be/{youtube_vid}"
                logger.info(f"✅ [{lang.upper()}] 유튜브 업로드 완료: {youtube_url}")
            else:
                logger.warning(f"⚠️ [{lang.upper()}] 유튜브 업로드 결과 비디오 ID를 받지 못했습니다.")
        except Exception as yt_err:
            logger.error(f"❌ [{lang.upper()}] 유튜브 업로드 실패: {yt_err}")

        # 3. 구글 드라이브 업로드 (사용자 요청으로 비활성화 - 유튜브 직접 다운로드 방식 사용)
        logger.info(f"📂 [{lang.upper()}] 구글 드라이브 업로드 단계 생략")
        drive_link = None

        results[lang] = {
            "youtube_url": youtube_url,
            "drive_link": drive_link
        }

        # 5. 로컬 임시 파일 정리
        try:
            if os.path.exists(rendered_path):
                os.remove(rendered_path)
                logger.info(f"🗑️ [{lang.upper()}] 업로드 완료된 로컬 임시 비디오 파일이 정리되었습니다.")
        except OSError as clean_err:
            logger.warning(f"⚠️ [{lang.upper()}] 로컬 임시 비디오 정리 오류: {clean_err}")

    # 4. 텔레그램 다국어 통합 알림 전송
    logger.info("📲 통합 다국어 배포 알림 발송 중...")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    alert_msg = f"""<b>🎬 스코어닉스 글로벌 AI 숏폼 제작 완료 ({mode.upper()})</b>
일시: {now_str}

<b>🔗 다운로드 및 퍼블릭 링크</b>
"""
    for lang, res in results.items():
        dl_link = res.get("drive_link") or "#"
        yt_link = res.get("youtube_url") or "#"
        alert_msg += f"""
<b>[{lang.upper()} 버전]</b>
📁 <a href="{dl_link}">구글 드라이브 비디오 다운로드</a>
📺 <a href="{yt_link}">유튜브 숏츠 바로가기</a>
"""

    alert_msg += f"""
<b>📲 SNS 복사용 기본 해시태그</b>
#스코어닉스 #AI분석 #스포츠데이터 #릴스 #Reels #TikTok #shorts
"""
    send_telegram_alert(alert_msg)
    
    return {"status": "success", "results": results}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Scorenix Shorts Scheduler Script")
    parser.add_argument("--mode", type=str, default="top_picks", choices=["marketing", "winning", "educational", "top_picks"], help="제작할 숏폼 모드 지정")
    parser.add_argument("--avatar", action="store_true", help="D-ID AI 아바타 활성화 여부")
    args = parser.parse_args()
    
    asyncio.run(run_distribution_pipeline(args.mode, args.avatar))
