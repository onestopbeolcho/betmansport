import httpx, json

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"

# Step 1: Trigger crawl to save to Firestore
print("Step 1: Triggering Betman crawl...")
r1 = httpx.post(f"{BASE}/api/admin/betman/crawl", timeout=120)
print(f"  Status: {r1.status_code}")
if r1.status_code == 200:
    d = r1.json()
    print(f"  Success: {d.get('success')}, Count: {d.get('count')}")
else:
    print(f"  Error: {r1.text[:300]}")

# Step 2: Check status
print("\nStep 2: Checking status...")
r2 = httpx.get(f"{BASE}/api/admin/betman/status", timeout=30)
print(f"  {json.dumps(r2.json(), indent=2) if r2.status_code == 200 else r2.text[:200]}")

# Step 3: Test debug endpoint
print("\nStep 3: Testing /api/bets/debug...")
r3 = httpx.get(f"{BASE}/api/bets/debug", timeout=300)
print(f"  Status: {r3.status_code}")

if r3.status_code == 200:
    data = r3.json()
    print(f"  Betman: {data.get('betman_count')} games")
    print(f"  Pinnacle: {data.get('pinnacle_count')} games")
    print(f"  Matched: {data.get('matched_count')}")
    print(f"  Unmatched: {data.get('unmatched_count')}")
    
    if data.get('matched'):
        print(f"\n  Matched pairs (first 5):")
        for m in data['matched'][:5]:
            print(f"    {m['betman']} == {m['pinnacle']}")
            vbs = [v for v in m.get('value_bets', []) if v['ev'] > 1.0]
            if vbs:
                for v in vbs:
                    print(f"      VALUE BET: {v['type']} EV={v['ev']:.4f}")
    
    if data.get('error'):
        print(f"\n  ERROR: {data['error']}")
        print(data.get('traceback', '')[:500])
    
    with open("debug_result.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
