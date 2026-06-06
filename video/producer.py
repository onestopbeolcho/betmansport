"""
Scorenix Video Producer
시나리오 정의를 받아 Playwright로 실행하고, ffmpeg로 자막을 합성하는 영상 제작 엔진
"""
import asyncio
import logging
import os
import shutil
import tempfile
from typing import Optional

from .scenarios.base import BaseScenario, Action

logger = logging.getLogger(__name__)

# 스크롤 시 사용할 점진적 이동 JS 함수
_SMOOTH_SCROLL_JS = """
async function smoothScrollTo(targetY, durationMs) {
    const startY = window.scrollY;
    const diff = targetY - startY;
    if (diff === 0) return;
    const startTime = performance.now();
    return new Promise(resolve => {
        function step(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            // easeInOut 커브
            const ease = progress < 0.5
                ? 2 * progress * progress
                : -1 + (4 - 2 * progress) * progress;
            window.scrollTo(0, startY + diff * ease);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
}
"""

# 요소 강조 하이라이트 JS
_HIGHLIGHT_JS = """
function highlightElement(selector, durationMs) {
    const el = document.querySelector(selector);
    if (!el) return;
    const original = el.style.cssText;
    el.style.outline = '4px solid #ff4444';
    el.style.outlineOffset = '4px';
    el.style.boxShadow = '0 0 20px rgba(255,68,68,0.6)';
    el.style.transition = 'all 0.3s ease';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
        el.style.cssText = original;
    }, durationMs);
}
"""


async def _execute_action(page, action: Action) -> None:
    """단일 액션 실행"""
    t = action.type

    if t == "goto":
        await page.goto(action.value, wait_until="domcontentloaded", timeout=30000)

    elif t == "wait":
        await asyncio.sleep(action.duration or 1.0)

    elif t == "scroll":
        target_y = action.value or 500
        dur_ms = int((action.duration or 3.0) * 1000)
        await page.evaluate(f"{_SMOOTH_SCROLL_JS} smoothScrollTo({target_y}, {dur_ms});")
        await asyncio.sleep((action.duration or 3.0) + 0.3)

    elif t == "scroll_top":
        dur_ms = int((action.duration or 1.5) * 1000)
        await page.evaluate(f"{_SMOOTH_SCROLL_JS} smoothScrollTo(0, {dur_ms});")
        await asyncio.sleep((action.duration or 1.5) + 0.3)

    elif t == "scroll_to":
        if action.selector:
            try:
                el = page.locator(action.selector).first
                await el.scroll_into_view_if_needed(timeout=5000)
            except Exception:
                pass
        await asyncio.sleep(1.0)

    elif t == "click":
        if action.selector:
            try:
                await page.click(action.selector, timeout=8000)
            except Exception as e:
                logger.warning(f"click 실패 ({action.selector}): {e}")
        await asyncio.sleep(0.5)

    elif t == "hover":
        if action.selector:
            try:
                await page.hover(action.selector, timeout=8000)
            except Exception as e:
                logger.warning(f"hover 실패 ({action.selector}): {e}")
        await asyncio.sleep(action.duration or 1.5)

    elif t == "type":
        if action.selector and action.value:
            try:
                await page.fill(action.selector, action.value, timeout=8000)
            except Exception as e:
                logger.warning(f"type 실패 ({action.selector}): {e}")
        await asyncio.sleep(0.5)

    elif t == "type_slow":
        if action.selector and action.value:
            try:
                await page.click(action.selector, timeout=8000)
                total_dur = action.duration or 3.0
                delay_ms = int(total_dur * 1000 / max(len(action.value), 1))
                delay_ms = max(delay_ms, 80)
                await page.type(action.selector, action.value, delay=delay_ms)
            except Exception as e:
                logger.warning(f"type_slow 실패 ({action.selector}): {e}")
        await asyncio.sleep(0.5)

    elif t == "clear":
        if action.selector:
            try:
                await page.fill(action.selector, "", timeout=5000)
            except Exception:
                pass

    elif t == "highlight":
        if action.selector:
            dur_ms = int((action.duration or 2.0) * 1000)
            try:
                await page.evaluate(
                    f"{_HIGHLIGHT_JS} highlightElement({repr(action.selector)}, {dur_ms});"
                )
            except Exception as e:
                logger.warning(f"highlight 실패 ({action.selector}): {e}")
        await asyncio.sleep(action.duration or 2.0)

    else:
        logger.warning(f"알 수 없는 액션 유형: {t}")


async def produce(
    scenario: BaseScenario,
    output_path: str,
    headless: bool = True,
) -> bool:
    """
    시나리오를 실행하여 webm 영상을 녹화합니다.
    overlay.py를 통해 ffmpeg 자막 합성은 별도 수행합니다.

    Args:
        scenario: 실행할 시나리오 인스턴스
        output_path: 최종 저장 경로 (.webm)
        headless: True면 백그라운드 실행

    Returns:
        성공 여부 (bool)
    """
    from playwright.async_api import async_playwright

    logger.info(f"🎥 영상 제작 시작: [{scenario.name}] → {output_path}")
    temp_dir = tempfile.mkdtemp()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=headless,
                args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
            )

            context = await browser.new_context(
                viewport={"width": scenario.viewport_width, "height": scenario.viewport_height},
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                ),
                record_video_dir=temp_dir,
                record_video_size={"width": scenario.viewport_width, "height": scenario.viewport_height},
            )

            page = await context.new_page()

            # 액션 순차 실행
            for i, action in enumerate(scenario.steps):
                logger.info(f"  [{i+1}/{len(scenario.steps)}] 액션: {action.type} {action.value or action.selector or ''}")
                try:
                    await _execute_action(page, action)
                except Exception as e:
                    logger.warning(f"  ⚠️ 액션 {action.type} 오류 (계속): {e}")

            await context.close()
            await browser.close()

        # 녹화 파일 찾기 및 복사
        files = [f for f in os.listdir(temp_dir) if f.endswith(".webm") or f.endswith(".mp4")]
        if not files:
            logger.error("❌ 녹화 파일이 생성되지 않았습니다.")
            return False

        newest = max(
            [os.path.join(temp_dir, f) for f in files],
            key=os.path.getmtime
        )

        out_dir = os.path.dirname(output_path)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)

        shutil.copy2(newest, output_path)
        logger.info(f"✅ 녹화 완료: {output_path}")
        return True

    except Exception as e:
        logger.error(f"❌ 영상 제작 실패: {e}", exc_info=True)
        return False

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
