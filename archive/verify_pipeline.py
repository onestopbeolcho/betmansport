"""
Complete verification of Betman crawler data pipeline
"""
import httpx
import json
import sys

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"
results = []

def log(msg):
    print(msg)
    results.append(msg)

log("=" * 60)
log("Pipeline Verification")
log("=" * 60)

# Test 1: Manual crawl trigger
log("\n[1] Manual crawl trigger...")
try:
    r = httpx.post(f"{BASE}/api/admin/betman/crawl", timeout=300)
    log(f"  Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        log(f"  Success: {data.get('success')}")
        log(f"  Count: {data.get('count')}")
        log(f"  Round: {data.get('round_id')}")
        log(f"  Source: {data.get('source')}")
        if data.get('matches'):
            for m in data['matches'][:3]:
                log(f"    {m['team_home']} vs {m['team_away']} W={m['home_odds']} D={m['draw_odds']} L={m['away_odds']}")
    else:
        log(f"  Body: {r.text[:300]}")
except Exception as e:
    log(f"  Error: {e}")

# Test 2: Saved rounds
log("\n[2] Saved rounds in Firestore...")
try:
    r = httpx.get(f"{BASE}/api/admin/betman/rounds", timeout=60)
    log(f"  Status: {r.status_code}")
    if r.status_code == 200:
        rounds = r.json()
        log(f"  Rounds count: {len(rounds)}")
        for rd in rounds[:5]:
            log(f"    {rd}")
    else:
        log(f"  Body: {r.text[:200]}")
except Exception as e:
    log(f"  Error: {e}")

# Test 3: Matches
log("\n[3] Latest matches...")
try:
    r = httpx.get(f"{BASE}/api/admin/betman/matches", timeout=60)
    log(f"  Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        log(f"  Round: {data.get('round_id')}")
        log(f"  Count: {data.get('count')}")
        for m in data.get('matches', [])[:3]:
            log(f"    {m.get('team_home')} vs {m.get('team_away')} W={m.get('home_odds')} D={m.get('draw_odds')} L={m.get('away_odds')}")
    else:
        log(f"  Body: {r.text[:200]}")
except Exception as e:
    log(f"  Error: {e}")

# Test 4: Value bets
log("\n[4] Value bets API...")
try:
    r = httpx.get(f"{BASE}/api/bets", timeout=120)
    log(f"  Status: {r.status_code}")
    if r.status_code == 200:
        bets = r.json()
        log(f"  Value bets: {len(bets)}")
        for b in bets[:3]:
            log(f"    {b}")
    else:
        log(f"  Body: {r.text[:200]}")
except Exception as e:
    log(f"  Error: {e}")

# Test 5: Scheduler status
log("\n[5] Scheduler status...")
try:
    r = httpx.get(f"{BASE}/api/scheduler/status", timeout=60)
    log(f"  Status: {r.status_code}")
    if r.status_code == 200:
        log(f"  {r.json()}")
    else:
        log(f"  Body: {r.text[:200]}")
except Exception as e:
    log(f"  Error: {e}")

log("\n" + "=" * 60)
log("DONE")

# Save results
with open("pipeline_result.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))
