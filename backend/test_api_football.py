import os
import sys
import httpx

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db

async def main():
    print("=== Testing API-Football Key ===")
    db = get_firestore_db()
    doc = db.collection("system_config").document("main_config").get()
    
    if not doc.exists:
        print("Error: system_config/main_config not found")
        return
        
    config = doc.to_dict()
    key = config.get("api_football_key") or config.get("API_FOOTBALL_KEY")
    if not key:
        print("Error: No API_FOOTBALL_KEY found in Firestore config")
        return
        
    print(f"Using key: {key[:5]}...{key[-5:]} (len: {len(key)})")
    
    # Test status endpoint
    url = "https://v3.football.api-sports.io/status"
    headers = {
        "x-apisports-key": key
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers)
            print(f"Status endpoint HTTP: {resp.status_code}")
            print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
