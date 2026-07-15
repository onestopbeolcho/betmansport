"""
Browser Recorder Service — 스코어닉스 경기 분석 화면 캡처
================================================================
/bets 페이지에서 각 경기 카드를 확장(더보기)하여 AI 분석 화면 스크린샷 캡처

구조:
  - /bets 리스트 → 카드 "더보기 ▼" 클릭 → 확장된 AI 분석 패널 스크린샷
  - 확장 패널 내용: 확률 도넛, H/D/A 바, AI 분석 요소(7-Factor), 추천 방향
  - /bets/view?id=X 는 사용하지 않음 (레거시)
"""
import os
import asyncio
import logging
import shutil
import tempfile
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

# 카드 확장 후 해당 카드로 스크롤 + 스크린샷을 위한 JS
SCROLL_TO_CARD_JS = """
(cardIndex) => {
    // grid 내 카드 찾기
    const grids = document.querySelectorAll('div[class*="grid"][class*="gap-4"]');
    for (const grid of grids) {
        const cards = grid.querySelectorAll(':scope > div');
        if (cards.length > 0 && cardIndex < cards.length) {
            const card = cards[cardIndex];
            card.scrollIntoView({ behavior: 'instant', block: 'start' });
            // 약간 위쪽으로 여유 (카드 상단이 화면 바로 위쪽에 오도록)
            window.scrollBy(0, -20);
            return true;
        }
    }
    return false;
}
"""


async def capture_match_screenshots(
    lang: str = "ko",
    max_matches: int = 5,
    viewport_width: int = 1080,
    viewport_height: int = 1920,
) -> List[Dict]:
    """
    /bets 페이지에서 각 경기 카드를 확장하고 AI 분석 화면을 스크린샷으로 캡처합니다.

    Returns:
        [
            {"screenshot_path": "...", "match_name": "...", "scene": "intro"|"match"},
            ...
        ]
    """
    from playwright.async_api import async_playwright

    base_url = "https://scorenix.com"
    bets_url = f"{base_url}/{lang}/bets" if lang != "ko" else f"{base_url}/bets"

    logger.info(f"[Recorder] 경기 스크린샷 캡처 시작: {bets_url}")

    temp_dir = tempfile.mkdtemp(prefix="scorenix_shots_")
    results = []

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

            # ── 1) /bets 페이지 로드 ──────────────────────────────────────
            logger.info("[Recorder] 페이지 로딩...")
            try:
                await page.goto(bets_url, wait_until="networkidle", timeout=30000)
            except Exception:
                try:
                    await page.goto(bets_url, wait_until="domcontentloaded", timeout=15000)
                except Exception as e:
                    logger.warning(f"[Recorder] 페이지 로드 경고: {e}")

            # 애니메이션 완료 대기 (countUp 1200ms + 확률바 1000ms)
            await asyncio.sleep(3.0)

            # 투어 비활성화
            try:
                await page.evaluate(DISABLE_TOUR_JS)
            except Exception:
                pass
            await asyncio.sleep(0.5)
            try:
                await page.evaluate(DISABLE_TOUR_JS)
            except Exception:
                pass

            # ── 2) 인트로: /bets 전체 화면 (AI Engine + Top Picks) ────────
            intro_path = os.path.join(temp_dir, "intro.png")
            await page.screenshot(path=intro_path, full_page=False)
            results.append({
                "screenshot_path": intro_path,
                "match_name": "SCORENIX AI REPORT",
                "scene": "intro",
            })
            logger.info("[Recorder] 인트로 스크린샷 완료")

            # ── 3) 경기 카드 찾기 ("더보기" 버튼 목록) ────────────────────
            # 카드의 "더보기 ▼" 버튼 찾기
            expand_buttons = await page.query_selector_all('button')
            more_buttons = []
            for btn in expand_buttons:
                try:
                    text = await btn.inner_text()
                    if '더보기' in text or '▼' in text or 'more' in text.lower():
                        more_buttons.append(btn)
                except Exception:
                    continue

            logger.info(f"[Recorder] '더보기' 버튼 {len(more_buttons)}개 발견")

            if not more_buttons:
                logger.warning("[Recorder] 더보기 버튼 없음 — 카드를 직접 탐색 시도")
                # 폴백: grid 내 카드들의 클릭 가능한 버튼 찾기
                try:
                    cards = await page.query_selector_all('div[class*="grid"][class*="gap-4"] > div')
                    logger.info(f"[Recorder] 폴백: grid 내 카드 {len(cards)}개 발견")
                except Exception:
                    cards = []

            # ── 4) 각 경기 카드 확장 → 스크린샷 ───────────────────────────
            num_matches = min(len(more_buttons), max_matches) if more_buttons else 0

            for idx in range(num_matches):
                try:
                    btn = more_buttons[idx]

                    # 버튼이 화면에 보이도록 스크롤
                    await btn.scroll_into_view_if_needed()
                    await asyncio.sleep(0.3)

                    # 카드에서 매치 이름 추출
                    match_name = f"Match {idx + 1}"
                    try:
                        # 버튼의 부모 카드에서 텍스트 추출
                        card_el = await btn.evaluate_handle(
                            "el => el.closest('div[class*=\"rounded-2xl\"]')"
                        )
                        if card_el:
                            card_text = await card_el.inner_text()
                            lines = [l.strip() for l in card_text.split('\n') if l.strip()]
                            # 팀 이름 찾기 (보통 "홈팀" 과 "vs" 또는 "어웨이팀" 패턴)
                            for line in lines:
                                if 'vs' in line.lower() or len(line) > 3:
                                    match_name = line[:60]
                                    break
                    except Exception:
                        pass

                    # 더보기 버튼 클릭 → 카드 확장
                    await btn.click()
                    await asyncio.sleep(1.5)  # 확장 애니메이션 + AI 분석 요소 로딩

                    # 확장된 카드가 보이도록 스크롤
                    await btn.scroll_into_view_if_needed()
                    await asyncio.sleep(0.5)

                    # 스크린샷 캡처
                    shot_path = os.path.join(temp_dir, f"match_{idx}.png")
                    await page.screenshot(path=shot_path, full_page=False)

                    results.append({
                        "screenshot_path": shot_path,
                        "match_name": match_name,
                        "scene": "match",
                    })
                    logger.info(f"[Recorder] 경기 {idx+1}/{num_matches}: {match_name[:30]}")

                    # 카드 접기 (다음 카드를 위해)
                    try:
                        # "접기 ▲" 버튼 찾아서 클릭
                        fold_buttons = await page.query_selector_all('button')
                        for fb in fold_buttons:
                            try:
                                ft = await fb.inner_text()
                                if '접기' in ft or '▲' in ft:
                                    await fb.click()
                                    await asyncio.sleep(0.5)
                                    break
                            except Exception:
                                continue
                    except Exception:
                        pass

                except Exception as err:
                    logger.warning(f"[Recorder] 경기 {idx+1} 캡처 실패: {err}")
                    continue

            await context.close()
            await browser.close()

        logger.info(f"[Recorder] 총 {len(results)}개 스크린샷 캡처 완료")
        return results

    except Exception as e:
        logger.error(f"[Recorder] 캡처 실패: {e}", exc_info=True)
        return results


# 하위 호환
async def record_page(url, output_path, duration=15.0, viewport_width=540, viewport_height=960):
    return False

async def record_scorenix_bets(output_path, duration=55.0, viewport_width=540, viewport_height=960, lang="ko"):
    return False


if __name__ == "__main__":
    import logging as _log
    _log.basicConfig(level=_log.INFO, format="%(asctime)s %(levelname)s %(message)s")
    async def _test():
        res = await capture_match_screenshots(lang="ko", max_matches=3)
        for r in res:
            print(f"  [{r['scene']}] {r['match_name']} -> {r['screenshot_path']}")
    asyncio.run(_test())
