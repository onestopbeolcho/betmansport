"""
Local Betman Crawler → Cloud Push (API only, no Firebase SDK needed)
Crawls Betman locally (bypasses GCP IP blocking) and pushes to Cloud via API.

Usage: python local_crawl_to_firestore.py
"""
import sys, os, uuid, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import httpx

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"


def crawl_and_push():
    from app.services.crawler_betman import BetmanCrawler
    
    print("🔄 Crawling Betman locally...")
    crawler = BetmanCrawler()
    items = crawler.fetch_odds()
    
    if not items:
        print("❌ No games found")
        return 0
    
    round_id = crawler.last_round_id or f"local_{__import__('datetime').datetime.now().strftime('%Y%m%d_%H%M')}"
    print(f"✅ Crawled {len(items)} games, round: {round_id}")
    
    # Convert to dicts
    matches = []
    for item in items:
        matches.append({
            "match_id": str(uuid.uuid4())[:8],
            "team_home": item.team_home,
            "team_away": item.team_away,
            "home_odds": item.home_odds,
            "draw_odds": item.draw_odds,
            "away_odds": item.away_odds,
            "sport": item.sport or "Soccer",
            "league": item.league or "",
            "match_time": item.match_time or "",
            "source": "local_crawl",
            "modified": False,
        })
    
    # Push to Cloud via API
    print(f"📤 Pushing {len(matches)} matches to Firestore via API...")
    r = httpx.post(
        f"{BASE}/api/admin/betman/push",
        json={"round_id": round_id, "matches": matches},
        timeout=60,
    )
    
    if r.status_code == 200:
        data = r.json()
        print(f"✅ {data.get('message')}")
        return data.get("count", 0)
    else:
        print(f"❌ Push failed: {r.status_code} - {r.text[:300]}")
        return 0


if __name__ == "__main__":
    count = crawl_and_push()
    if count:
        print(f"\n🎉 {count} games: Local crawl → Firestore ✅")
    else:
        print("\n❌ Failed")
