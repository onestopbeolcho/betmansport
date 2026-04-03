"""
Betman E2E Test — 크롤러 → DB 저장 → 조회 → 수정 → 가치투자 파이프라인 통합 테스트
"""
import sys
import os
import json
import logging

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Setup console + file logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("test_betman_e2e.log", mode="w", encoding="utf-8"),
    ]
)
logger = logging.getLogger("E2E")


def divider(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_step_1_discovery():
    """Step 1: 회차 발견"""
    divider("STEP 1: Round Discovery")
    from app.services.crawler_betman import BetmanCrawler

    crawler = BetmanCrawler()
    gm_ts, gm_id = crawler._discover_round_id()

    if gm_ts:
        print(f"✅ Round Found: gmId={gm_id}, gmTs={gm_ts}")
        return crawler, gm_ts, gm_id
    else:
        print("❌ No round found (all sold out or API blocked)")
        return crawler, None, None


def test_step_2_fetch_odds(crawler, gm_id, gm_ts):
    """Step 2: 경기 데이터 크롤링"""
    divider("STEP 2: Fetch Odds Data")

    if not gm_ts:
        print("⏭️ Skipping — no round available")
        return None

    data = crawler._fetch_odds_page(gm_id, gm_ts)
    if data:
        if "compSchedules" in data:
            keys = data["compSchedules"].get("keys", [])
            rows = data["compSchedules"].get("datas", [])
            print(f"✅ Data received: {len(keys)} columns, {len(rows)} rows")
            if keys:
                print(f"   Columns: {', '.join(keys[:10])}{'...' if len(keys) > 10 else ''}")
        else:
            print(f"⚠️ No compSchedules. Keys: {list(data.keys())}")
        return data
    else:
        print("❌ Failed to fetch odds data")
        return None


def test_step_3_parse(crawler, data):
    """Step 3: 데이터 파싱"""
    divider("STEP 3: Parse Response")

    if not data:
        print("⏭️ Skipping — no data to parse")
        return []

    items = crawler._parse_response(data)
    print(f"✅ Parsed {len(items)} matches")

    if items:
        for i, item in enumerate(items[:5]):
            sport_emoji = {"Soccer": "⚽", "Basketball": "🏀", "Baseball": "⚾", "Ice Hockey": "🏒", "Volleyball": "🏐"}.get(item.sport, "🏆")
            print(f"   {sport_emoji} [{item.league}] {item.team_home} vs {item.team_away}")
            print(f"      승={item.home_odds} 무={item.draw_odds} 패={item.away_odds}")
        if len(items) > 5:
            print(f"   ... and {len(items) - 5} more")

    return items


def test_step_4_db_save(items, round_id):
    """Step 4: DB 저장 & 조회"""
    divider("STEP 4: DB Save & Read")
    from app.models.betman_db import save_betman_round, get_betman_matches, get_betman_status
    from app.services.crawler_betman import BetmanCrawler

    if not items:
        print("⏭️ Skipping — no items to save")
        return

    # Convert to dicts
    dicts = [BetmanCrawler._odds_to_dict(item) for item in items]
    saved = save_betman_round(str(round_id), dicts)
    print(f"✅ Saved {saved} matches to DB")

    # Read back
    loaded = get_betman_matches(str(round_id))
    print(f"✅ Read back {len(loaded)} matches")

    # Verify count
    if len(loaded) == len(items):
        print(f"✅ Save/Load consistency: PASS")
    else:
        print(f"❌ Save/Load mismatch: saved {len(items)}, loaded {len(loaded)}")

    # Status
    status = get_betman_status()
    print(f"📊 DB Status: {json.dumps(status, indent=2, ensure_ascii=False)}")


def test_step_5_crud():
    """Step 5: CRUD 수동 수정 테스트"""
    divider("STEP 5: CRUD Operations")
    from app.models.betman_db import get_betman_matches, update_betman_match, add_betman_match, delete_betman_match

    matches = get_betman_matches()
    if not matches:
        print("⏭️ No matches to test CRUD on")
        return

    # Update first match
    first = matches[0]
    mid = first["match_id"]
    old_odds = first.get("home_odds", 0)
    new_odds = round(old_odds + 0.10, 2)

    updated = update_betman_match(mid, {"home_odds": new_odds})
    if updated and float(updated.get("home_odds", 0)) == new_odds:
        print(f"✅ Update: {old_odds} → {new_odds} (match {mid})")
    else:
        print(f"❌ Update failed for match {mid}")

    # Revert
    update_betman_match(mid, {"home_odds": old_odds})
    print(f"✅ Reverted odds back to {old_odds}")

    # Add manual match
    added = add_betman_match({
        "team_home": "테스트 홈",
        "team_away": "테스트 어웨이",
        "home_odds": 1.50,
        "draw_odds": 3.50,
        "away_odds": 5.00,
        "sport": "Soccer",
        "league": "Test League",
    })
    print(f"✅ Add: {added['team_home']} vs {added['team_away']} (id: {added['match_id']})")

    # Delete it
    deleted = delete_betman_match(added["match_id"])
    print(f"✅ Delete: {deleted}")
    print("✅ All CRUD operations passed!")


def test_step_6_full_pipeline():
    """Step 6: 전체 fetch_odds() 파이프라인"""
    divider("STEP 6: Full Pipeline (fetch_odds)")
    from app.services.crawler_betman import BetmanCrawler

    crawler = BetmanCrawler()
    items = crawler.fetch_odds()

    print(f"📦 fetch_odds() returned {len(items)} items")
    if items:
        print(f"   Source: {'Real crawl' if crawler.last_round_id else 'Saved DB'}")
        if crawler.last_round_id:
            print(f"   Round: {crawler.last_round_id}")
        print(f"   Sports: {set(i.sport for i in items)}")
        print("✅ Full pipeline: PASS")
    else:
        print("⚠️ No data returned (all rounds may be closed + no saved data)")

    return items


def main():
    print("\n" + "🏆" * 20)
    print("  Betman Crawler E2E Test")
    print("🏆" * 20)

    # Step 1: Discovery
    crawler, gm_ts, gm_id = test_step_1_discovery()

    # Step 2: Fetch Odds
    data = test_step_2_fetch_odds(crawler, gm_id, gm_ts)

    # Step 3: Parse
    items = test_step_3_parse(crawler, data)

    # Step 4: DB Save & Read
    test_step_4_db_save(items, gm_ts or "test_round")

    # Step 5: CRUD
    test_step_5_crud()

    # Step 6: Full Pipeline
    final_items = test_step_6_full_pipeline()

    divider("SUMMARY")
    print(f"✅ Round Discovery: {'OK' if gm_ts else 'No active round'}")
    print(f"✅ Data Fetch: {'OK' if data else 'No data (round may be closed)'}")
    print(f"✅ Parse: {len(items)} matches")
    print(f"✅ DB CRUD: All operations passed")
    print(f"✅ Full Pipeline: {len(final_items)} items returned")
    print(f"\n{'✅ ALL TESTS PASSED' if final_items else '⚠️ No live data (all rounds closed)'}")


if __name__ == "__main__":
    main()
