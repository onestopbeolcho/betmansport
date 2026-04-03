"""Playwright 브라우저 크롤러 단독 테스트"""
import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("BrowserTest")

from app.services.crawler_betman_browser import crawl_betman_via_browser

def main():
    print("=" * 60)
    print("  Betman Browser Crawler Test (Playwright)")
    print("=" * 60)

    result = crawl_betman_via_browser(headless=True)

    print(f"\nSuccess: {result['success']}")
    print(f"Round: {result['round_id']}")
    print(f"Game ID: {result['game_id']}")
    print(f"Matches: {len(result['matches'])}")
    print(f"Error: {result['error']}")

    if result['matches']:
        print("\nMatches:")
        sport_emoji = {"Soccer": "⚽", "Basketball": "🏀", "Baseball": "⚾", "Ice Hockey": "🏒", "Volleyball": "🏐"}
        for m in result['matches'][:10]:
            emoji = sport_emoji.get(m['sport'], "🏆")
            print(f"  {emoji} [{m['league']}] {m['team_home']} vs {m['team_away']}")
            print(f"      W={m['home_odds']} D={m['draw_odds']} L={m['away_odds']}")
        if len(result['matches']) > 10:
            print(f"  ... and {len(result['matches']) - 10} more")

    if result['raw_discovery']:
        proto = result['raw_discovery'].get('protoGames', [])
        print(f"\nProto games in discovery: {len(proto)}")
        for g in proto:
            state = g.get('mainState')
            status = g.get('mainStatusMessage', '')
            print(f"  {g.get('gmId')} gmTs={g.get('gmTs')} state={state} ({status})")

    print(f"\n{'✅ BROWSER CRAWL SUCCESS' if result['success'] else '⚠️ Browser crawl returned no live data'}")


if __name__ == "__main__":
    main()
