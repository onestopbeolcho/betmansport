"""Comprehensive verification of deployed API"""
import httpx
import json

BASE = "https://us-central1-smart-proto-inv-2026.cloudfunctions.net/api"

tests = [
    ("Root", "GET", "/"),
    ("OpenAPI Docs", "GET", "/docs"),
    ("Value Bets (Betman+Pinnacle)", "GET", "/api/bets"),
    ("Admin Betman Rounds", "GET", "/api/admin/betman/rounds"),
    ("Market Summary", "GET", "/api/market/summary"),
    ("Prediction Leaderboard", "GET", "/api/prediction/leaderboard"),
    ("Scheduler Status", "GET", "/api/scheduler/status"),
]

print(f"{'='*60}")
print(f"  Deployed API Verification: {BASE}")
print(f"{'='*60}\n")

passed = 0
failed = 0

for name, method, path in tests:
    try:
        url = f"{BASE}{path}"
        if method == "GET":
            r = httpx.get(url, timeout=60, follow_redirects=True)
        else:
            r = httpx.post(url, timeout=60)
        
        status = "PASS" if r.status_code < 500 else "FAIL"
        if status == "PASS":
            passed += 1
        else:
            failed += 1
        
        # Show response preview
        body = r.text[:200].replace("\n", " ")
        print(f"[{status}] {name}")
        print(f"  URL: {path}")
        print(f"  Status: {r.status_code}")
        print(f"  Body: {body}")
        print()
        
    except Exception as e:
        failed += 1
        print(f"[FAIL] {name}")
        print(f"  URL: {path}")
        print(f"  Error: {str(e)[:100]}")
        print()

print(f"{'='*60}")
print(f"  Results: {passed} passed, {failed} failed")
print(f"{'='*60}")
