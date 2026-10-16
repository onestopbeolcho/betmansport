import os
import sys
import httpx

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db

async def main():
    print("=== Testing API-Football Standings & Fixtures ===")
    db = get_firestore_db()
    doc = db.collection("system_config").document("main_config").get()
    
    config = doc.to_dict()
    key = config.get("api_football_key") or config.get("API_FOOTBALL_KEY")
    if not key:
        print("Error: No API_FOOTBALL_KEY found")
        return
        
    headers = {"x-apisports-key": key}
    
    async with httpx.AsyncClient() as client:
        # Test standings for EPL (39) with different seasons
        for season in [2025, 2026]:
            url = "https://v3.football.api-sports.io/standings"
            params = {"league": 39, "season": season}
            try:
                resp = await client.get(url, headers=headers, params=params)
                print(f"Season {season} Standings HTTP: {resp.status_code}")
                # print part of response
                print(f"Response snippet: {resp.text[:300]}")
            except Exception as e:
                print(f"Season {season} request failed: {e}")
                
        # Test upcoming fixtures for K-League (292) with 2026
        url = "https://v3.football.api-sports.io/fixtures"
        params = {"league": 292, "season": 2026, "next": 5}
        try:
            resp = await client.get(url, headers=headers, params=params)
            print(f"K-League 2026 Fixtures HTTP: {resp.status_code}")
            print(f"Response snippet: {resp.text[:300]}")
        except Exception as e:
            print(f"K-League request failed: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
