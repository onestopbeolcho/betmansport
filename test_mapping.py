"""
Test team mapper matching rate against current Betman data.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.services.team_mapper import TeamMapper
from app.services.crawler_betman import BetmanCrawler

mapper = TeamMapper()

print(f"TeamMapper stats: {mapper.get_stats()}")
print()

# Fetch Betman data
print("Fetching Betman data...")
crawler = BetmanCrawler()
items = crawler.fetch_odds()
print(f"Betman games: {len(items)}")

# Test mapping for each team
matched = 0
unmatched = []
for item in items:
    en_h = mapper.get_english_name(item.team_home)
    en_a = mapper.get_english_name(item.team_away)
    
    if en_h and en_a:
        matched += 1
        print(f"  OK: {item.team_home}({en_h}) vs {item.team_away}({en_a})")
    else:
        unmatched.append({
            "home": item.team_home, "home_en": en_h,
            "away": item.team_away, "away_en": en_a,
            "league": item.league
        })

print(f"\nMatching rate: {matched}/{len(items)} ({matched/len(items)*100:.0f}%)")
print(f"\nUnmatched ({len(unmatched)}):")
for u in unmatched:
    missing = []
    if not u["home_en"]:
        missing.append(f"HOME: {u['home']}")
    if not u["away_en"]:
        missing.append(f"AWAY: {u['away']}")
    print(f"  [{u['league']}] {', '.join(missing)}")
