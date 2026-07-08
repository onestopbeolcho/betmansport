"""
Browser Recorder Service — 실시간 스코어닉스 화면 녹화
=======================================================
- Playwright (Headless Chromium) 기반 화면 캡처 & 비디오 녹화
- 모바일 뷰포트 (540x960, 9:16 비율)
- 투어/온보딩 오버레이 강제 비활성화 (localStorage 플래그 주입)
- 페이지 로드 후 자연스러운 스크롤 시뮬레이션
- /bets 경기 분석 페이지 녹화 → 영상 배경으로 활용
"""
import os
import asyncio
import logging
import shutil
import tempfile

logger = logging.getLogger(__name__)

# 투어/온보딩 비활성화용 localStorage 키 목록
# OnboardingTour.tsx의 tourId 기반으로 생성되는 키들
TOUR_DISABLE_SCRIPT = """
// 모든 투어 완료 처리 (OnboardingTour.tsx의 localStorage 키 패턴 매칭)
const tourKeys = [
    'scorenix_tour_bets_completed',
    'scorenix_tour_market_completed',
    'scorenix_tour_analysis_completed',
    'scorenix_tour_home_completed',
    'scorenix_tour_completed',
    'toured_bets',
    'toured_market',
    'toured_home',
    'tour_completed',
    'onboarding_done',
    'joyride_done',
];
tourKeys.forEach(k => {
    try { localStorage.setItem(k, 'true'); } catch(e) {}
});

// Joyride/ReactJoyride가 사용하는 패턴도 처리
try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(k => {
        if (k.includes('tour') || k.includes('onboard') || k.includes('joyride')) {
            localStorage.setItem(k, 'true');
        }
    });
} catch(e) {}

// CSS로 오버레이/스포트라이트 강제 숨김
const style = document.createElement('style');
style.id = 'scorenix-recorder-override';
style.textContent = `
    [class*="joyride"],
    [class*="tour"],
    [class*="spotlight"],
    [class*="overlay"],
    [class*="onboarding"],
    [data-tour],
    .__floater,
    .react-joyride__overlay,
    .react-joyride__spotlight,
    .react-joyride__tooltip {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        z-index: -9999 !important;
    }
`;
document.head.appendChild(style);
console.log('[Recorder] Tour overlays disabled.');
"""

# 경기 분석 페이지로 자연스럽게 스크롤하는 스크립트
SCROLL_SCRIPT = """
async function smoothScrollRecording(totalDuration) {
    await new Promise(r => setTimeout(r, 800)); // 초기 대기

    const pageHeight = document.body.scrollHeight;
    const viewHeight = window.innerHeight;
    const scrollable = pageHeight - viewHeight;

    if (scrollable <= 50) {
        await new Promise(r => setTimeout(r, totalDuration * 1000));
        return;
    }

    // Phase 1: 위에서 아래로 (전체 시간의 70%)
    const downDuration = totalDuration * 0.7;
    const downSteps = Math.floor(downDuration * 1000 / 40);
    const downStep = scrollable / downSteps;

    for (let i = 0; i < downSteps; i++) {
        window.scrollBy(0, downStep);
        await new Promise(r => setTimeout(r, 40));
    }

    // Phase 2: 잠깐 대기 (전체 시간의 10%)
    await new Promise(r => setTimeout(r, totalDuration * 0.1 * 1000));

    // Phase 3: 위로 천천히 스크롤 백 (전체 시간의 20%)
    const upDuration = totalDuration * 0.2;
    const upSteps = Math.floor(upDuration * 1000 / 60);
    const upStep = window.scrollY / upSteps;

    for (let i = 0; i < upSteps; i++) {
        window.scrollBy(0, -upStep);
        await new Promise(r => setTimeout(r, 60));
    }
}
"""


async def record_scorenix_bets(
    output_path: str,
    duration: float = 55.0,
    viewport_width: int = 540,
    viewport_height: int = 960,
    lang: str = "ko",
) -> bool:
    """
    스코어닉스 /bets (경기 분석) 페이지를 모바일 크기로 녹화합니다.

    Args:
        output_path: 출력 파일 경로 (.webm 또는 .mp4)
        duration: 녹화 시간 (초), 기본 55초
        viewport_width: 뷰포트 너비 (기본 540 — 모바일)
        viewport_height: 뷰포트 높이 (기본 960)
        lang: 언어 코드 (ko/en/ja)
    Returns:
        성공 여부
    """
    from playwright.async_api import async_playwright

    # 언어별 URL 결정
    base_url = "https://scorenix.com"
    if lang == "ko":
        target_url = f"{base_url}/bets"
    else:
        target_url = f"{base_url}/{lang}/bets"

    logger.info(f"[Recorder] 녹화 시작: {target_url} (뷰포트: {viewport_width}x{viewport_height}, {duration}초)")

    temp_dir = tempfile.mkdtemp(prefix="scorenix_rec_")

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-gpu",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process",
                    "--autoplay-policy=no-user-gesture-required",
                ]
            )

            # 모바일 컨텍스트 — iPhone 느낌
            context = await browser.new_context(
                viewport={"width": viewport_width, "height": viewport_height},
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/17.0 Mobile/15E148 Safari/604.1"
                ),
                record_video_dir=temp_dir,
                record_video_size={"width": viewport_width, "height": viewport_height},
                locale="ko-KR" if lang == "ko" else ("en-US" if lang == "en" else "ja-JP"),
                color_scheme="dark",
            )

            page = await context.new_page()

            # ── Step 1: localStorage에 투어 완료 플래그 미리 심기 ───────────
            # 페이지 로드 전 빈 페이지에서 먼저 실행 (about:blank)
            await page.goto("about:blank")
            await page.evaluate(f"""
                // about:blank에서는 scorenix.com origin의 localStorage에 접근 불가
                // 실제 페이지 로드 후 실행 예정 — 여기서는 쿠키 초기화만
                console.log('[Recorder] Pre-init done');
            """)

            # ── Step 2: 페이지 로드 ─────────────────────────────────────────
            logger.info(f"[Recorder] 페이지 로딩 중: {target_url}")
            try:
                await page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
            except Exception as goto_err:
                logger.warning(f"[Recorder] 페이지 로드 타임아웃, 계속 진행: {goto_err}")

            # ── Step 3: 투어 오버레이 즉시 비활성화 ─────────────────────────
            await asyncio.sleep(1.0)  # 초기 JS 실행 대기
            try:
                await page.evaluate(TOUR_DISABLE_SCRIPT)
                logger.info("[Recorder] 투어 오버레이 비활성화 완료")
            except Exception as tour_err:
                logger.warning(f"[Recorder] 투어 비활성화 경고 (무시): {tour_err}")

            # ── Step 4: 추가 1초 대기 후 재확인 ─────────────────────────────
            # 일부 SPA에서 React 재렌더링으로 오버레이가 다시 나타날 수 있음
            await asyncio.sleep(1.5)
            try:
                await page.evaluate(TOUR_DISABLE_SCRIPT)
            except Exception:
                pass

            # ── Step 5: 스크롤 녹화 ─────────────────────────────────────────
            scroll_time = max(duration - 4.0, 5.0)
            logger.info(f"[Recorder] 스크롤 녹화 시작 ({scroll_time}초)...")
            try:
                await page.evaluate(
                    f"""
                    ({SCROLL_SCRIPT})
                    smoothScrollRecording({scroll_time});
                    """
                )
                # 스크롤이 비동기로 실행되므로 실제 녹화 시간만큼 대기
                await asyncio.sleep(scroll_time + 1.0)
            except Exception as scroll_err:
                logger.warning(f"[Recorder] 스크롤 경고 (무시): {scroll_err}")
                await asyncio.sleep(duration)

            # ── Step 6: 컨텍스트 닫기 ───────────────────────────────────────
            await context.close()
            await browser.close()

        # ── Step 7: 녹화된 파일 찾아서 이동 ────────────────────────────────
        video_files = [
            f for f in os.listdir(temp_dir)
            if f.endswith(".webm") or f.endswith(".mp4")
        ]

        if not video_files:
            logger.error("[Recorder] 녹화 파일이 생성되지 않았습니다.")
            return False

        newest = max(
            [os.path.join(temp_dir, f) for f in video_files],
            key=os.path.getmtime
        )

        out_dir = os.path.dirname(output_path)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)

        shutil.copy2(newest, output_path)
        size_mb = os.path.getsize(output_path) / 1024 / 1024
        logger.info(f"[Recorder] 녹화 완료: {output_path} ({size_mb:.1f} MB)")
        return True

    except Exception as e:
        logger.error(f"[Recorder] 녹화 실패: {e}", exc_info=True)
        return False

    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass


# 하위 호환성 — 기존 record_page 함수도 유지
async def record_page(
    url: str,
    output_path: str,
    duration: float = 15.0,
    viewport_width: int = 540,
    viewport_height: int = 960,
) -> bool:
    """하위 호환성 유지용 래퍼 — 내부적으로 record_scorenix_bets 호출"""
    # URL에서 언어 코드 추출
    lang = "ko"
    if "/en/" in url or url.endswith("/en"):
        lang = "en"
    elif "/ja/" in url or url.endswith("/ja"):
        lang = "ja"

    return await record_scorenix_bets(
        output_path=output_path,
        duration=duration,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        lang=lang,
    )


if __name__ == "__main__":
    import logging as _logging
    _logging.basicConfig(level=_logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    test_out = os.path.join(os.getcwd(), "test_record.webm")
    asyncio.run(record_scorenix_bets(test_out, duration=15.0))
    print(f"테스트 녹화 완료: {test_out}")
