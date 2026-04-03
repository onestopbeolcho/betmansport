"""
Debug the value bet pipeline — check both data sources and matching
"""
import httpx
import json

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"

# 1. Check Betman data in DB
print("[1] Betman DB data...")
r1 = httpx.get(f"{BASE}/api/admin/betman/matches", timeout=60)
print(f"  Status: {r1.status_code}")
if r1.status_code == 200:
    d = r1.json()
    print(f"  Count: {d.get('count')}")
    for m in d.get('matches', [])[:3]:
        print(f"    {m.get('team_home')} vs {m.get('team_away')} W={m.get('home_odds')} D={m.get('draw_odds')} L={m.get('away_odds')}")

# 2. Check Pinnacle data
print("\n[2] Pinnacle/Odds API data...")
r2 = httpx.get(f"{BASE}/api/scheduler/status", timeout=60)
if r2.status_code == 200:
    s = r2.json()
    print(f"  API key configured: {s.get('api_key_configured')}")
    print(f"  Requests remaining: {s.get('requests_remaining')}")
    print(f"  Cache age: {s.get('cache_age_seconds')}")

# 3. Try to trigger odds collection first
print("\n[3] Triggering odds collection...")
r3 = httpx.post(f"{BASE}/api/scheduler/collect-odds", timeout=120)
print(f"  Status: {r3.status_code}")
if r3.status_code == 200:
    d3 = r3.json()
    print(f"  Response: {json.dumps(d3, indent=2)[:500]}")

# 4. Now test bets again
print("\n[4] Testing /api/bets after collection...")
r4 = httpx.get(f"{BASE}/api/bets", timeout=300)
print(f"  Status: {r4.status_code}")
if r4.status_code == 200:
    bets = r4.json()
    print(f"  Value bets: {len(bets)}")
    for b in bets[:5]:
        print(f"    {b.get('match_name')} [{b.get('bet_type')}] EV={b.get('expected_value')}")
