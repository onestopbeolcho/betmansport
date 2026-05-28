"""
Browser Recorder Service — 실시간 웹 화면 모바일 자동 녹화
- Playwright (Headless/Headed Chromium) 기반 화면 캡처 및 레코딩
- 모바일 뷰포트 (540x960, 9:16 비율) 최적화
- 브라우저 스크롤 및 마우스 오버 등 상호작용 시뮬레이션
- 녹화 완료 후 파일 리네임 및 지정 경로 저장
"""
import os
import sys
import asyncio
import logging
import shutil
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)


async def record_page(
    url: str,
    output_path: str,
    duration: float = 15.0,
    viewport_width: int = 540,
    viewport_height: int = 960,
) -> bool:
    """
    지정한 URL에 모바일 크기로 접속하여, smooth 스크롤링 상호작용을 수행하면서 화면을 자동 녹화합니다.
    Args:
        url: 접속할 웹사이트 주소
        output_path: 저장할 최종 동영상 경로 (.webm 또는 .mp4)
        duration: 녹화 시간 (초)
        viewport_width: 가로 크기 (기본 540)
        viewport_height: 세로 크기 (기본 960)
    Returns:
        성공 여부
    """
    from playwright.async_api import async_playwright

    logger.info(f"🎥 웹 브라우저 녹화 시작: {url} (시간: {duration}초)")
    
    # 1. 임시 녹화 디렉토리 생성 (Playwright는 해당 디렉토리에 임의 파일명으로 녹화함)
    temp_dir = tempfile.mkdtemp()
    
    try:
        async with async_playwright() as p:
            # 2. 브라우저 실행 (백그라운드 headless=True)
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
            )
            
            # 3. 모바일 컨텍스트 및 녹화 설정
            context = await browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
                record_video_dir=temp_dir,
                record_video_size={"width": viewport_width, "height": viewport_height}
            )
            
            page = await context.new_page()
            
            # 4. 웹페이지 접속 및 대기
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(1.5) # 페이지 로딩 완료 후 잠시 대기
            
            # 5. 브라우저 사이드 Smooth 스크롤 스크립트 실행 (자연스러운 스크롤)
            scroll_script = """
            async function smoothScroll(scrollDuration) {
                const distance = document.body.scrollHeight - window.innerHeight;
                if (distance <= 0) return;
                
                const delay = 30; // ms
                const steps = (scrollDuration * 1000) / delay;
                const stepSize = distance / steps;
                
                for (let i = 0; i < steps; i++) {
                    window.scrollBy(0, stepSize);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            """
            
            # 녹화 도중 자연스러운 액션 시뮬레이션
            # 스크롤 시간 = 전체 녹화 시간 - 여유 대기 시간
            scroll_time = max(duration - 3.0, 3.0)
            
            # 동기로 실행하여 스크롤이 끝날 때까지 대기
            try:
                await page.evaluate(f"({scroll_script})({scroll_time})")
            except Exception as eval_e:
                logger.warning(f"Scroll evaluation notice: {eval_e}")
            
            # 남은 녹화 시간 만큼 대기
            remaining = duration - scroll_time
            if remaining > 0:
                await asyncio.sleep(remaining)
            
            # 6. 리소스 안전 종료
            await context.close()
            await browser.close()
            
        # 7. 녹화 파일 탐색 및 최종 경로 이동
        files = os.listdir(temp_dir)
        video_files = [f for f in files if f.endswith(".webm") or f.endswith(".mp4")]
        
        if not video_files:
            logger.error("❌ 녹화 동영상이 생성되지 않았습니다.")
            return False
            
        # 가장 최근에 생성된 비디오 파일 선택
        newest_video = max(
            [os.path.join(temp_dir, f) for f in video_files],
            key=os.path.getmtime
        )
        
        # 출력 디렉토리 확인 및 복사
        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
            
        shutil.copy2(newest_video, output_path)
        logger.info(f"✅ 웹 브라우저 녹화 저장 성공: {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ 웹 브라우저 녹화 중 예외 발생: {e}", exc_info=True)
        return False
        
    finally:
        # 임시 디렉토리 클린업
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


if __name__ == "__main__":
    # 로컬 간단 테스트 실행
    logging.basicConfig(level=logging.INFO)
    test_out = os.path.join(os.getcwd(), "test_record.webm")
    asyncio.run(record_page("https://scorenix.com", test_out, duration=10.0))
