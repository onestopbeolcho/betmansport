"""Test WAF bypass strategies for Betman API using requests + httpx"""
import requests
import warnings
import time
import json

warnings.filterwarnings("ignore")

url = "https://www.betman.co.kr/buyPsblGame/inqBuyAbleGameInfoList.do"
main_url = "https://www.betman.co.kr/"

ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

print("=" * 60)
print("Strategy A: requests library with session")
print("=" * 60)

session = requests.Session()
session.verify = False
session.headers.update({"User-Agent": ua})

# Step 1: Get main page + cookies
print("Step 1: Acquiring cookies...")
try:
    main_r = session.get(main_url, timeout=15)
    print(f"  Main: {main_r.status_code}, cookies={list(session.cookies.keys())}")
except Exception as e:
    print(f"  Main page error: {e}")

time.sleep(1)

# Step 2: API with cookies
print("Step 2: API call with session cookies...")
api_headers = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
    "Origin": "https://www.betman.co.kr",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
}

try:
    r = session.post(url, headers=api_headers, data={}, timeout=15)
    ct = r.headers.get("content-type", "")
    print(f"  Status: {r.status_code}, CT: {ct}, Len: {len(r.content)}")
    
    if "application/json" in ct:
        data = r.json()
        msg = data.get("rsMsg", {}).get("message", "N/A")
        print(f"  Message: {msg}")
        proto = data.get("protoGames", [])
        print(f"  Proto games: {len(proto)}")
        for g in proto:
            print(f"    {g.get('gmId')} gmTs={g.get('gmTs')} state={g.get('mainState')} {g.get('mainStatusMessage','')}")
        print("\n  >>> SUCCESS <<<")
        # Save for analysis
        with open("betman_session_result.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        # Save WAF HTML for analysis
        with open("betman_waf_response.html", "w", encoding="utf-8") as f:
            f.write(r.text)
        print(f"  WAF HTML saved to betman_waf_response.html")
        # Check if it has a JS challenge
        if "script" in r.text.lower()[:500]:
            print("  Contains <script> tag - likely JS challenge")
        print(f"  Snippet: {r.text[:300]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("Strategy B: Direct POST with requests (no session)")
print("=" * 60)
try:
    full_headers = {**api_headers, "User-Agent": ua}
    r2 = requests.post(url, headers=full_headers, data={}, verify=False, timeout=15)
    ct2 = r2.headers.get("content-type", "")
    print(f"  Status: {r2.status_code}, CT: {ct2}, Len: {len(r2.content)}")
    if "application/json" in ct2:
        data2 = r2.json()
        print(f"  Proto games: {len(data2.get('protoGames', []))}")
        print("  >>> SUCCESS <<<")
    else:
        print(f"  WAF blocked. Snippet: {r2.text[:200]}")
except Exception as e:
    print(f"  Error: {e}")

print("\nDone.")
