
import httpx
import asyncio
import sys

# Force UTF-8
sys.stdout.reconfigure(encoding='utf-8')

async def test_prediction():
    base_url = "http://localhost:8000/api/prediction"
    match_id = "ManCity_Liverpool"
    user_id = "tester_king"
    
    print(f"Testing Prediction API at: {base_url}\n")
    
    async with httpx.AsyncClient() as client:
        # 1. Submit Prediction
        print("--- 1. Submit Prediction ---")
        pred_payload = {
            "match_id": match_id, 
            "user_id": user_id, 
            "selection": "Home", 
            "odds": 1.85
        }
        res = await client.post(f"{base_url}/submit", json=pred_payload)
        if res.status_code == 200:
            print("Prediction Success:", res.json())
        else:
            print("Prediction Failed:", res.status_code, res.text)
            
        # 2. Get User Stats (Before Settlement)
        print("\n--- 2. Get User Stats (Initial) ---")
        res = await client.get(f"{base_url}/user/{user_id}")
        if res.status_code == 200:
            print("Stats:", res.json())

        # 3. Trigger Settlement (Internal Function via Python, not API for now, or just trust mock?)
        # Since settlement is a service function, let's just inspect the leaderboard for the existing mock users first.
        
        # 4. Get Leaderboard
        print("\n--- 4. Get Leaderboard ---")
        res = await client.get(f"{base_url}/leaderboard")
        if res.status_code == 200:
            lb = res.json()
            print(f"Leaderboard Top 3:")
            for item in lb[:3]:
                print(f"Rank {item['rank']}: {item['user_id']} ({item['points']} XP) - {item['tier']}")
        else:
            print("Get Leaderboard Failed:", res.status_code)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_prediction())
