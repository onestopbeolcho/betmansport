import requests
import time

def trigger_updates():
    print(">>> Triggering API Updates...")
    try:
        # 1. Update Config (create row in DB)
        requests.post("http://localhost:8000/api/admin/config", json={
            "pinnacle_api_key": "DB_TEST_KEY",
            "betman_user_agent": "DB_Agent_v1",
            "scrape_interval_minutes": 15
        })
        print("Config Updated.")
        
        # 2. Fetch Bets (trigers save to DB)
        res = requests.get("http://localhost:8000/api/bets")
        if res.status_code != 200:
            print(f"FAILED: {res.status_code}")
            print(res.text)
        else:
            print(f"Bets Fetched: {len(res.json())} items found.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    trigger_updates()
