"""Intercept actual XHR calls from Betman page to learn the correct request format"""
import sys, os, json, logging
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s",
                    handlers=[logging.StreamHandler(), logging.FileHandler("browser_intercept.log", mode="w", encoding="utf-8")])
logger = logging.getLogger("intercept")

from playwright.sync_api import sync_playwright

captured_requests = []
captured_responses = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale="ko-KR",
        ignore_https_errors=True,
    )
    page = ctx.new_page()

    # Intercept all requests
    def on_request(request):
        if "buyPsblGame" in request.url or "gameInfo" in request.url or "inq" in request.url.lower():
            info = {
                "url": request.url,
                "method": request.method,
                "headers": dict(request.headers),
                "post_data": request.post_data,
            }
            captured_requests.append(info)
            logger.info(f">>> REQUEST: {request.method} {request.url}")
            logger.info(f"    Content-Type: {request.headers.get('content-type', 'N/A')}")
            logger.info(f"    Post data: {request.post_data}")

    def on_response(response):
        if "buyPsblGame" in response.url or "gameInfo" in response.url or "inq" in response.url.lower():
            ct = response.headers.get("content-type", "")
            logger.info(f"<<< RESPONSE: {response.status} {response.url} (ct={ct})")
            try:
                body = response.text()
                if "json" in ct:
                    data = json.loads(body)
                    if "protoGames" in data:
                        games = data["protoGames"]
                        logger.info(f"    Proto games: {len(games)}")
                        for g in games:
                            logger.info(f"    {g.get('gmId')} gmTs={g.get('gmTs')} state={g.get('mainState')} {g.get('mainStatusMessage','')}")
                    if "compSchedules" in data:
                        rows = len(data["compSchedules"].get("datas", []))
                        logger.info(f"    Odds: {rows} rows")
                else:
                    logger.info(f"    HTML ({len(body)} bytes)")
                    
                captured_responses.append({"url": response.url, "status": response.status, "ct": ct, "body": body[:500]})
            except Exception as e:
                logger.info(f"    Error reading response: {e}")

    page.on("request", on_request)
    page.on("response", on_response)

    # Navigate to game list page — this should trigger the initial data load
    logger.info("Navigating to game buy page...")
    page.goto("https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do", 
              wait_until="networkidle", timeout=30000)
    logger.info(f"Page loaded: {page.title()}")
    
    # Wait for any delayed AJAX
    page.wait_for_timeout(3000)

    logger.info(f"\n=== Captured {len(captured_requests)} API requests ===")
    for i, req in enumerate(captured_requests):
        logger.info(f"  [{i}] {req['method']} {req['url']}")
        logger.info(f"      CT: {req['headers'].get('content-type', 'N/A')}")
        logger.info(f"      Body: {req['post_data']}")

    logger.info(f"\n=== Captured {len(captured_responses)} API responses ===")
    for i, resp in enumerate(captured_responses):
        logger.info(f"  [{i}] {resp['status']} {resp['url']} ct={resp['ct']}")

    # Check if the page has game data rendered
    game_count = page.evaluate("document.querySelectorAll('.gameList, .game-item, .tbl_game, tr[class]').length")
    logger.info(f"\nGame elements on page: {game_count}")
    
    # Check if there's a requestClient utility
    has_req_client = page.evaluate("typeof requestClient !== 'undefined'")
    logger.info(f"requestClient available: {has_req_client}")
    
    has_bui = page.evaluate("typeof BUICommon !== 'undefined'")
    logger.info(f"BUICommon available: {has_bui}")

    browser.close()
    print(f"\nCaptured {len(captured_requests)} requests, {len(captured_responses)} responses")
