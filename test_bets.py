import httpx

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"

print("Testing /api/bets (value bets)...")
r = httpx.get(f"{BASE}/api/bets", timeout=300)
print(f"Status: {r.status_code}")

if r.status_code == 200:
    bets = r.json()
    print(f"Value bets found: {len(bets)}")
    for b in bets[:5]:
        print(f"  {b.get('match_name')} [{b.get('bet_type')}]")
        print(f"    EV={b.get('expected_value'):.4f} Kelly={b.get('kelly_pct'):.2f}% Odds={b.get('domestic_odds')}")
else:
    print(f"Body: {r.text[:500]}")
