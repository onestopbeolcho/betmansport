import sys
import os
import logging

# Add the current directory to sys.path to allow importing 'app'
sys.path.append(os.getcwd())

from app.services.crawler_betman_browser import crawl_betman_via_browser

logging.basicConfig(level=logging.INFO)

def test_browser_crawler():
    print("Starting Browser Crawler Test...")
    # Run with headless=False to potentially see what's happening if I could, 
    # but here I'll just run it and see the result.
    result = crawl_betman_via_browser(headless=True)
    
    if result["success"]:
        print(f"SUCCESS! Found {len(result['matches'])} matches.")
        # Print first 2 matches
        for m in result["matches"][:2]:
            print(f" - {m['team_home']} vs {m['team_away']}: {m['home_odds']} / {m['draw_odds']} / {m['away_odds']}")
    else:
        print(f"FAILED: {result['error']}")
        if result.get("raw_discovery"):
            print("Discovery API responded, but maybe no matches found.")
        else:
            print("Discovery API call failed completely.")

if __name__ == "__main__":
    test_browser_crawler()
