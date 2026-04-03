"""
Local comparison: Betman teams vs Pinnacle teams
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

import json

# 1. Betman teams from local crawl
print("[1] Fetching Betman data locally...")
from app.services.crawler_betman import BetmanCrawler
crawler = BetmanCrawler()
betman_items = crawler.fetch_odds()
print(f"  Betman games: {len(betman_items)}")

betman_teams = set()
betman_info = []
for item in betman_items:
    betman_teams.add(item.team_home)
    betman_teams.add(item.team_away)
    betman_info.append({
        "home": item.team_home,
        "away": item.team_away,
        "league": item.league or "",
        "sport": item.sport or ""
    })

# 2. Pinnacle teams from The Odds API
print("[2] Fetching Pinnacle data...")
import httpx

api_key = os.getenv("PINNACLE_API_KEY", "")
if not api_key:
    # Try to load from .env
    env_path = os.path.join("backend", ".env")
    if os.path.exists(env_path):
        for line in open(env_path):
            if line.startswith("PINNACLE_API_KEY"):
                api_key = line.split("=", 1)[1].strip().strip('"')
                break

pinnacle_teams = set()
pinnacle_info = []

if api_key:
    sports = ["soccer_epl", "soccer_spain_la_liga", "soccer_germany_bundesliga",
              "soccer_italy_serie_a", "soccer_france_ligue_one", "soccer_uefa_champs_league",
              "basketball_nba", "basketball_euroleague"]
    for sport in sports:
        try:
            url = f"https://api.the-odds-api.com/v4/sports/{sport}/odds"
            params = {"apiKey": api_key, "regions": "eu", "markets": "h2h", "oddsFormat": "decimal"}
            r = httpx.get(url, params=params, timeout=15)
            if r.status_code == 200:
                data = r.json()
                for ev in data:
                    h = ev.get("home_team", "")
                    a = ev.get("away_team", "")
                    pinnacle_teams.add(h)
                    pinnacle_teams.add(a)
                    pinnacle_info.append({
                        "home": h, "away": a,
                        "league": ev.get("sport_title", ""),
                        "sport": ev.get("sport_key", "")
                    })
                print(f"  {sport}: {len(data)} events")
        except Exception as e:
            print(f"  {sport}: Error {e}")
else:
    print("  No API key found")

# Save
result = {
    "betman": {
        "count": len(betman_info),
        "teams": sorted(list(betman_teams)),
        "matches": betman_info
    },
    "pinnacle": {
        "count": len(pinnacle_info),
        "teams": sorted(list(pinnacle_teams)),
        "matches": pinnacle_info
    }
}

with open("team_names_comparison.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n{'='*60}")
print(f"BETMAN: {len(betman_info)} games, {len(betman_teams)} teams")
for t in sorted(betman_teams):
    print(f"  KR: {t}")

print(f"\nPINNACLE: {len(pinnacle_info)} games, {len(pinnacle_teams)} teams")
for t in sorted(pinnacle_teams):
    print(f"  EN: {t}")

print(f"\nSaved to team_names_comparison.json")
