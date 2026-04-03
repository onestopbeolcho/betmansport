import httpx, json, sys

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"

print("=== Testing /api/bets endpoint ===")
try:
    r = httpx.get(f"{BASE}/api/bets", timeout=120)
    print(f"Status: {r.status_code}")
    data = r.json()
    
    if isinstance(data, list):
        print(f"Items returned: {len(data)}")
        if len(data) > 0:
            print(f"\nFirst 3 entries:")
            for i, item in enumerate(data[:3]):
                print(f"  {i+1}. {item.get('match_name', 'N/A')}")
                print(f"     Type: {item.get('bet_type', 'N/A')}, EV: {item.get('expected_value', 'N/A')}")
                print(f"     Domestic: {item.get('domestic_odds', 'N/A')}, Pinnacle: {item.get('pinnacle_odds', 'N/A')}")
            print(f"\n... and {len(data)-3} more entries")
        else:
            print("EMPTY list returned!")
    else:
        print(f"Unexpected response type: {type(data)}")
        print(json.dumps(data, indent=2, ensure_ascii=False)[:500])

except Exception as e:
    print(f"Error: {e}")

print()
print("=== Testing /api/market/pinnacle endpoint ===")
try:
    r = httpx.get(f"{BASE}/api/market/pinnacle", timeout=120)
    print(f"Status: {r.status_code}")
    data = r.json()
    print(f"Items: {len(data)}")
except Exception as e:
    print(f"Error: {e}")
