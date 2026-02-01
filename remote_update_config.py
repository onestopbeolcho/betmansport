import requests
import json
import sys

url = "http://localhost:8000/api/admin/config"
payload = {
    "pinnacle_api_key": "d6aaa4bdc8bd3042aa553fb955d95f7b",
    "betman_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "scrape_interval_minutes": 10
}

print(f"Sending payload to {url}...")
try:
    resp = requests.post(url, json=payload)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
    if resp.status_code == 200:
        print("SUCCESS: Configuration Updated.")
    else:
        print("FAILED: Server rejected request.")
except Exception as e:
    print(f"CONNECTION ERROR: {e}")
