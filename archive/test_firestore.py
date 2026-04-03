import httpx, json

BASE = "https://asia-northeast3-smart-proto-inv-2026.cloudfunctions.net/api"

# First try a simple Firestore status check
print("Testing /betman/status (Firestore read)...")
r = httpx.get(f"{BASE}/api/admin/betman/status", timeout=60)
print(f"Status: {r.status_code}")
print(f"Body: {r.text[:500]}")

# Try crawl
print("\nTesting /betman/crawl...")
r2 = httpx.post(f"{BASE}/api/admin/betman/crawl", timeout=120)
print(f"Status: {r2.status_code}")
print(f"Body: {r2.text[:500]}")
