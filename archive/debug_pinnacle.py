import httpx, json

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"

# Check scheduler status for API details
print("=== Scheduler Status ===")
r = httpx.get(f"{BASE}/api/scheduler/status", timeout=60)
print(json.dumps(r.json(), indent=2) if r.status_code == 200 else f"Error: {r.status_code}")

# Trigger odds collection and save full response
print("\n=== Collect Odds ===")
r2 = httpx.post(f"{BASE}/api/scheduler/collect-odds", timeout=120)
print(f"Status: {r2.status_code}")
with open("pinnacle_response.json", "w", encoding="utf-8") as f:
    json.dump(r2.json() if r2.status_code == 200 else {"error": r2.text[:500]}, f, ensure_ascii=False, indent=2)
print(f"Response saved to pinnacle_response.json")

# Show first few items
if r2.status_code == 200:
    data = r2.json()
    if isinstance(data, dict):
        print(f"Keys: {list(data.keys())}")
        for k, v in data.items():
            if isinstance(v, list):
                print(f"  {k}: {len(v)} items")
                for item in v[:2]:
                    print(f"    {json.dumps(item, ensure_ascii=False)[:200]}")
            else:
                print(f"  {k}: {v}")
