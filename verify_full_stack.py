
import httpx
import time
import logging

logging.basicConfig(level=logging.INFO)

def verify():
    url = "http://localhost:8000/api/bets"
    print(f"Calling {url}...")
    
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(url)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Received {len(data)} bets.")
                betman_count = 0
                for item in data:
                    print(f" - {item.get('match_name')} ({item.get('provider')}) EV: {item.get('expected_value')}")
                    # Check provider inside detail or similar? 
                    # Actually schemas/odds.py says provider is not top level, 
                    # but maybe in the text?
                    # Let's just print the raw item first 
                    # print(item)
                    pass
            else:
                print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    time.sleep(5) # Wait for startup
    verify()
