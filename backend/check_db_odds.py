import os
import sys
import datetime
from datetime import timezone

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load env variables (if .env exists)
from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db
from app.services.pinnacle_api import pinnacle_service

async def main():
    print("=== Firestore Data Check ===")
    db = get_firestore_db()
    
    today_str = datetime.datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"Checking daily_portfolios for date: {today_str}")
    
    # 1. Check daily_portfolios
    doc_ref = db.collection("daily_portfolios").document(today_str)
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        matches = data.get("matches", [])
        print(f"\n[daily_portfolios] Found {len(matches)} matches (updated_at: {data.get('updated_at')})")
        for idx, m in enumerate(matches[:5]):
            print(f"  {idx+1}. {m.get('team_home_ko', m.get('team_home'))} vs {m.get('team_away_ko', m.get('team_away'))} ({m.get('league')})")
            print(f"     Confidence: {m.get('confidence')}%, Recommendation: {m.get('recommendation')}")
    else:
        print("\n[daily_portfolios] Document for today does not exist!")

    # 2. Check market_cache odds_snapshot
    print("\nChecking market_cache/odds_snapshot...")
    cache_doc_ref = db.collection("market_cache").document("odds_snapshot")
    cache_doc = cache_doc_ref.get()
    if cache_doc.exists:
        data = cache_doc.to_dict()
        import json
        try:
            raw_data = json.loads(data.get("data", "[]"))
            print(f"Found {len(raw_data)} matches in market_cache (updated_at: {data.get('updated_at')})")
            for idx, o in enumerate(raw_data[:5]):
                # print out home_team, away_team
                home = o.get("home_team", o.get("team_home", ""))
                away = o.get("away_team", o.get("team_away", ""))
                league = o.get("league", o.get("sport_title", ""))
                print(f"  {idx+1}. {home} vs {away} ({league})")
        except Exception as e:
            print(f"Failed to parse market_cache: {e}")
    else:
        print("[market_cache] odds_snapshot does not exist!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
