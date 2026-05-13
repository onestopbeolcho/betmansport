"""
Betman Browser Crawler — Playwright 기반 브라우저 자동화 크롤러
- 실제 Chrome 브라우저로 Betman WAF 완전 우회
- JS 실행 + 쿠키 자동 관리
- Headless 모드 지원
"""
import json
import logging
import traceback
from typing import Optional, List, Dict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def crawl_betman_via_browser(headless: bool = True) -> Dict:
    """
    Playwright 브라우저로 Betman API 호출.
    
    Returns:
        {
            "success": bool,
            "round_id": str | None,
            "game_id": str | None,
            "matches": list[dict],    # parsed OddsItem-compatible dicts
            "raw_discovery": dict,     # raw API response from discovery
            "raw_odds": dict,          # raw API response from odds
            "error": str | None,
        }
    """
    result = {
        "success": False,
        "round_id": None,
        "game_id": None,
        "matches": [],
        "raw_discovery": {},
        "raw_odds": {},
        "error": None,
    }

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        result["error"] = "Playwright not installed. Run: pip install playwright && python -m playwright install chromium"
        logger.error(result["error"])
        return result

    try:
        with sync_playwright() as p:
            logger.info(f"Launching browser (headless={headless})...")
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                viewport={"width": 1280, "height": 720},
                ignore_https_errors=True,
            )
            page = context.new_page()

            # ──────────────────────────────────────────────
            # Step 1: 메인 페이지 방문 (세션/쿠키 확보)
            # ──────────────────────────────────────────────
            logger.info("Step 1: Visiting Betman main page for cookies...")
            page.goto("https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do", wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)  # JS 실행 대기

            cookies = context.cookies()
            cookie_names = [c["name"] for c in cookies]
            logger.info(f"Cookies acquired: {cookie_names}")

            # ──────────────────────────────────────────────
            # Step 2: Discovery API — 활성 회차 조회
            # ──────────────────────────────────────────────
            logger.info("Step 2: Calling discovery API via browser...")
            
            discovery_script = """
            async () => {
                const response = await fetch('/buyPsblGame/inqBuyAbleGameInfoList.do', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                    },
                    body: JSON.stringify({"_sbmInfo":{"_sbmInfo":{"debugMode":"false"}}}),
                });
                const text = await response.text();
                return {
                    status: response.status,
                    contentType: response.headers.get('content-type'),
                    body: text,
                };
            }
            """
            
            disc_resp = page.evaluate(discovery_script)
            disc_status = disc_resp.get("status")
            disc_ct = disc_resp.get("contentType", "")
            disc_body = disc_resp.get("body", "")

            logger.info(f"Discovery: status={disc_status}, ct={disc_ct}, len={len(disc_body)}")

            if "application/json" not in disc_ct:
                result["error"] = f"Discovery returned non-JSON (ct={disc_ct})"
                logger.error(result["error"])
                logger.error(f"Body snippet: {disc_body[:300]}")
                browser.close()
                return result

            disc_data = json.loads(disc_body)
            result["raw_discovery"] = disc_data

            msg = disc_data.get("rsMsg", {}).get("message", "N/A")
            logger.info(f"Discovery message: {msg}")

            # Select best round
            gm_ts, gm_id = _select_best_round(disc_data)
            if not gm_ts:
                result["error"] = "No available rounds found"
                logger.warning(result["error"])
                browser.close()
                return result

            result["round_id"] = str(gm_ts)
            result["game_id"] = gm_id
            logger.info(f"📌 Selected round: gmId={gm_id}, gmTs={gm_ts}")

            # ──────────────────────────────────────────────
            # Step 3: Odds API — 경기/배당 데이터 조회
            # ──────────────────────────────────────────────
            logger.info("Step 3: Calling odds API via browser...")
            
            odds_script = """
            async (payload) => {
                const response = await fetch('/buyPsblGame/gameInfoInq.do', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                    },
                    body: JSON.stringify(payload),
                });
                const text = await response.text();
                return {
                    status: response.status,
                    contentType: response.headers.get('content-type'),
                    body: text,
                };
            }
            """
            
            payload = {
                "gmId": gm_id,
                "gmTs": gm_ts,
                "gameYear": "",
                "_sbmInfo": {"_sbmInfo": {"debugMode": "false"}},
            }
            
            odds_resp = page.evaluate(odds_script, payload)
            odds_status = odds_resp.get("status")
            odds_ct = odds_resp.get("contentType", "")
            odds_body = odds_resp.get("body", "")

            logger.info(f"Odds API: status={odds_status}, ct={odds_ct}, len={len(odds_body)}")

            if "application/json" not in odds_ct:
                snippet = odds_body[:200].replace('\n', ' ')
                result["error"] = f"Odds API returned non-JSON (ct={odds_ct}). Body snippet: {snippet}"
                logger.error(result["error"])
                browser.close()
                return result

            odds_data = json.loads(odds_body)
            result["raw_odds"] = odds_data

            # ──────────────────────────────────────────────
            # Step 4: Parse matches
            # ──────────────────────────────────────────────
            matches = _parse_odds_data(odds_data)
            result["matches"] = matches
            result["success"] = True

            logger.info(f"✅ Browser crawl complete: {len(matches)} matches from round {gm_ts}")

            browser.close()

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Browser crawl error: {e}")
        traceback.print_exc()

    return result


def _select_best_round(data: dict):
    """
    Select the best available round from discovery response.
    We currently ONLY support G101 (Proto Win/Draw/Loss).
    G102 (Record) uses a different structure and API payload.
    """
    proto_games = data.get("protoGames", [])
    logger.info(f"Found {len(proto_games)} proto games in discovery")

    # Filter only G101
    g101_games = [g for g in proto_games if g.get("gmId") == "G101"]
    
    if not g101_games:
        available_ids = [g.get("gmId") for g in proto_games]
        logger.warning(f"No G101 rounds found. Available IDs: {available_ids}")
        return None, None

    # Priority 1: Active G101 (mainState == 1: 발매중)
    for g in g101_games:
        if str(g.get("mainState")) == "1":
            logger.info(f"✅ Active G101 found: gmTs={g.get('gmTs')}")
            return g.get("gmTs"), "G101"

    # Priority 2: Latest G101 (even if closed)
    # The list is usually sorted by gmTs descending or at least contains the most recent ones.
    # We take the first one found.
    g = g101_games[0]
    logger.info(f"📁 No active G101. Falling back to latest G101: gmTs={g.get('gmTs')}")
    return g.get("gmTs"), "G101"


def _parse_odds_data(data: dict) -> List[Dict]:
    """Parse compSchedules into match dicts."""
    if "compSchedules" not in data:
        logger.warning("No compSchedules in odds response")
        return []

    keys = data["compSchedules"].get("keys", [])
    datas = data["compSchedules"].get("datas", [])

    if not datas:
        logger.info("compSchedules.datas is empty")
        return []

    idx = {k: i for i, k in enumerate(keys)}
    
    sport_map = {"SC": "Soccer", "BS": "Baseball", "BK": "Basketball", "VL": "Volleyball", "IC": "Ice Hockey"}
    matches = []
    skipped = {"inactive": 0, "handicap": 0, "no_odds": 0, "error": 0}

    for row in datas:
        try:
            status = row[idx["protoStatus"]] if "protoStatus" in idx else "0"
            handi = row[idx["handi"]] if "handi" in idx else 0

            if str(status) != "2":
                skipped["inactive"] += 1
                continue
            if handi not in [0, 15, 16]:
                skipped["handicap"] += 1
                continue

            home_odds = float(row[idx["winAllot"]]) if "winAllot" in idx and row[idx["winAllot"]] else 0.0
            draw_odds = float(row[idx["drawAllot"]]) if "drawAllot" in idx and row[idx["drawAllot"]] else 0.0
            away_odds = float(row[idx["loseAllot"]]) if "loseAllot" in idx and row[idx["loseAllot"]] else 0.0

            if home_odds <= 0 and away_odds <= 0:
                skipped["no_odds"] += 1
                continue

            match_time_ms = row[idx["gameDate"]] if "gameDate" in idx else 0
            match_time = datetime.fromtimestamp(match_time_ms / 1000.0, timezone.utc).isoformat() if match_time_ms else ""
            sport_code = row[idx["itemCode"]] if "itemCode" in idx else "SC"

            matches.append({
                "provider": "Betman",
                "sport": sport_map.get(sport_code, "Unknown"),
                "league": row[idx["leagueName"]] if "leagueName" in idx else "",
                "team_home": row[idx["homeName"]] if "homeName" in idx else "",
                "team_away": row[idx["awayName"]] if "awayName" in idx else "",
                "home_odds": home_odds,
                "draw_odds": draw_odds,
                "away_odds": away_odds,
                "match_time": match_time,
            })
        except Exception as e:
            skipped["error"] += 1
            continue

    logger.info(f"Parse: {len(matches)} valid, skipped={skipped}")
    return matches
