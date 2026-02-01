import requests
import json

BASE_URL = "http://localhost:8000/api/admin"

def verify_admin_api():
    print(">>> Testing Admin Config API...")
    
    # 1. Get Initial Config
    try:
        res = requests.get(f"{BASE_URL}/config")
        print(f"GET Status: {res.status_code}")
        print(f"Initial Config: {res.json()}")
    except Exception as e:
        print(f"FAILED to connect: {e}")
        return

    # 2. Update Config
    new_config = {
        "pinnacle_api_key": "TEST_KEY_123",
        "betman_user_agent": "TestAgent/1.0",
        "scrape_interval_minutes": 5
    }
    
    print("\n>>> Updating Config...")
    res = requests.post(f"{BASE_URL}/config", json=new_config)
    print(f"POST Status: {res.status_code}")
    print(f"Updated Config: {res.json()}")

    # 3. Verify Update
    print("\n>>> Verifying Update...")
    res = requests.get(f"{BASE_URL}/config")
    current_config = res.json()
    
    if current_config["pinnacle_api_key"] == "TEST_KEY_123":
        print("✅ Config updated successfully!")
    else:
        print("❌ Config update failed!")

if __name__ == "__main__":
    verify_admin_api()
