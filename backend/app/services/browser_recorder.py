"""
Browser Recorder Service — 스코어닉스 경기 분석 화면 캡처 (메모리 극최적화 버전)
================================================================
/bets 페이지에서 각 경기 카드를 확장(더보기)하여 AI 분석 화면 스크린샷 캡처

메모리 누수(OOM) 방지 설계:
  1. 매 스크린샷 캡처 루프마다 Playwright 브라우저를 론칭/클로즈하여 Chromium 메모리를 완전 리셋.
  2. 메모리 잔여 자원을 낭비하지 않도록 가비지 컬렉터(gc.collect)를 매 루프마다 명시적 호출.
"""
import os
import asyncio
import logging
import tempfile
import gc
from typing import List, Dict

logger = logging.getLogger(__name__)

DISABLE_TOUR_JS = """
(() => {
    const keys = [
        'scorenix_tour_bets_completed', 'scorenix_tour_market_completed',
        'scorenix_tour_home_completed', 'scorenix_tour_completed',
        'toured_bets', 'toured_market', 'toured_home',
        'tour_completed', 'onboarding_done', 'joyride_done'
    ];
    keys.forEach(k => { try { localStorage.setItem(k, 'true'); } catch(e) {} });
    const style = document.createElement('style');
    style.textContent = `
        [class*="joyride"], [class*="tour"], [class*="spotlight"],
        [class*="overlay"], [class*="onboarding"], .__floater,
        .react-joyride__overlay, .react-joyride__spotlight,
        .react-joyride__tooltip {
            display: none !important; opacity: 0 !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
})();
"""

async def capture_single_match_screenshot(
    bets_url: str,
    target_idx: int,
    output_path: str,
    viewport_width: int,
    viewport_height: int,
    lang: str
) -> Dict:
    """
    브라우저를 독립적으로 띄워 특정 인덱스의 경기 카드를 캡처하고 바로 종료합니다.
    """
    from playwright.async_api import async_playwright
    match_name = f"Match {target_idx + 1}"

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
            )

            context = await browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                device_scale_factor=1,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/17.0 Mobile/15E148 Safari/604.1"
                ),
                locale="ko-KR" if lang == "ko" else ("en-US" if lang == "en" else "ja-JP"),
                color_scheme="dark",
            )

            page = await context.new_page()

            # /bets 페이지 로드
            try:
                await page.goto(bets_url, wait_until="networkidle", timeout=25000)
            except Exception:
                try:
                    await page.goto(bets_url, wait_until="domcontentloaded", timeout=12000)
                except Exception:
                    pass

            await asyncio.sleep(2.0)

            # 온보딩 투어 제거
            try:
                await page.evaluate(DISABLE_TOUR_JS)
            except Exception:
                pass

            # 전체 버튼들 중에서 더보기 버튼 인덱스 재탐색
            expand_buttons = await page.query_selector_all('button')
            more_buttons = []
            for btn in expand_buttons:
                try:
                    text = await btn.inner_text()
                    if '더보기' in text or '▼' in text or 'more' in text.lower():
                        more_buttons.append(btn)
                except Exception:
                    continue

            if not more_buttons or target_idx >= len(more_buttons):
                logger.warning(f"[Recorder] 경기 {target_idx} 더보기 버튼 찾지 못함.")
                await context.close()
                await browser.close()
                return {"success": False, "match_name": match_name}

            btn = more_buttons[target_idx]

            # 경기명 파싱
            try:
                card_el = await btn.evaluate_handle(
                    "el => el.closest('div[class*=\"rounded-2xl\"]')"
                )
                if card_el:
                    card_text = await card_el.inner_text()
                    lines = [l.strip() for l in card_text.split('\n') if l.strip()]
                    for line in lines:
                        if 'vs' in line.lower() or len(line) > 3:
                            match_name = line[:60]
                            break
            except Exception:
                pass

            # 더보기 버튼 위치로 스크롤 및 클릭
            await btn.scroll_into_view_if_needed()
            await asyncio.sleep(0.2)
            await btn.click()
            
            # 패널 확장 및 데이터 로딩 대기
            await asyncio.sleep(1.5)

            # 확장된 상태 스냅샷
            await btn.scroll_into_view_if_needed()
            await asyncio.sleep(0.3)
            await page.screenshot(path=output_path, full_page=False)

            await context.close()
            await browser.close()

            return {
                "success": True,
                "screenshot_path": output_path,
                "match_name": match_name,
                "scene": "match"
            }

    except Exception as e:
        logger.error(f"[Recorder] 단일 경기 캡처 {target_idx} 실패: {e}")
        return {"success": False, "match_name": match_name}


async def capture_match_screenshots(
    lang: str = "ko",
    max_matches: int = 5,
    viewport_width: int = 1080,
    viewport_height: int = 1920,
) -> List[Dict]:
    """
    경기 리스트를 가져온 뒤, 각 경기를 개별 브라우저 론칭 방식으로 스크린샷 캡처합니다.
    """
    from playwright.async_api import async_playwright

    base_url = "https://scorenix.com"
    bets_url = f"{base_url}/{lang}/bets" if lang != "ko" else f"{base_url}/bets"

    logger.info(f"[Recorder] [최적화] 경기 스크린샷 캡처 시작: {bets_url}")

    temp_dir = tempfile.mkdtemp(prefix="scorenix_shots_")
    results = []

    # ── 1) 인트로 캡처용 론칭 ──────────────────────────────────
    intro_path = os.path.join(temp_dir, "intro.png")
    num_matches = 0

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
            )
            context = await browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                device_scale_factor=1,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/17.0 Mobile/15E148 Safari/604.1"
                ),
                locale="ko-KR" if lang == "ko" else ("en-US" if lang == "en" else "ja-JP"),
                color_scheme="dark",
            )
            page = await context.new_page()

            try:
                await page.goto(bets_url, wait_until="networkidle", timeout=25000)
            except Exception:
                try:
                    await page.goto(bets_url, wait_until="domcontentloaded", timeout=12000)
                except Exception:
                    pass

            await asyncio.sleep(2.5)

            # 온보딩 오버레이 제거
            try:
                await page.evaluate(DISABLE_TOUR_JS)
            except Exception:
                pass

            await page.screenshot(path=intro_path, full_page=False)
            results.append({
                "screenshot_path": intro_path,
                "match_name": "SCORENIX AI REPORT",
                "scene": "intro",
            })
            logger.info("[Recorder] 인트로 스크린샷 완료")

            # 경기 카드 개수 파악
            expand_buttons = await page.query_selector_all('button')
            more_buttons_count = 0
            for btn in expand_buttons:
                try:
                    text = await btn.inner_text()
                    if '더보기' in text or '▼' in text or 'more' in text.lower():
                        more_buttons_count += 1
                except Exception:
                    continue

            num_matches = min(more_buttons_count, max_matches)
            logger.info(f"[Recorder] 캡처 대상 경기 카드 수: {num_matches}개")

            await context.close()
            await browser.close()
    except Exception as intro_err:
        logger.error(f"[Recorder] 인트로 캡처 실패: {intro_err}")

    # 가비지 컬렉터 강제 실행
    gc.collect()

    # ── 2) 각 경기를 개별 브라우저 론칭으로 캡처 ─────────────────────────────
    for idx in range(num_matches):
        shot_path = os.path.join(temp_dir, f"match_{idx}.png")
        logger.info(f"[Recorder] 경기 {idx+1}/{num_matches} 개별 캡처 시도...")
        
        res = await capture_single_match_screenshot(
            bets_url=bets_url,
            target_idx=idx,
            output_path=shot_path,
            viewport_width=viewport_width,
            viewport_height=viewport_height,
            lang=lang
        )
        
        if res.get("success", False):
            results.append({
                "screenshot_path": res["screenshot_path"],
                "match_name": res["match_name"],
                "scene": "match"
            })
            logger.info(f"[Recorder] 경기 {idx+1} 캡처 성공: {res['match_name'][:30]}")
        
        # 메모리 반환
        gc.collect()
        await asyncio.sleep(0.5)

    logger.info(f"[Recorder] 총 {len(results)}개 리소스 확보 완료")
    return results

# 하위 호환
async def record_page(url, output_path, duration=15.0, viewport_width=540, viewport_height=960):
    return False

async def record_scorenix_bets(output_path, duration=55.0, viewport_width=540, viewport_height=960, lang="ko"):
    return False
