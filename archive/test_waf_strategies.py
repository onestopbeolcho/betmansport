"""WAF bypass strategy test for Betman API"""
import httpx
import json

url = "https://www.betman.co.kr/buyPsblGame/inqBuyAbleGameInfoList.do"

def show_result(label, resp):
    ct = resp.headers.get("content-type", "")
    print(f"{label}: status={resp.status_code}, ct={ct}, len={len(resp.content)}")
    if "application/json" in ct:
        data = resp.json()
        games = data.get("protoGames", [])
        print(f"  => protoGames: {len(games)}")
        for g in games[:3]:
            print(f"     {g.get('gmId')} / gmTs={g.get('gmTs')} / state={g.get('mainState')} / {g.get('mainStatusMessage','')}")
    else:
        snippet = resp.text[:300].replace("\n", " ")
        print(f"  => HTML: {snippet}")

base_headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
    "Origin": "https://www.betman.co.kr",
    "X-Requested-With": "XMLHttpRequest",
}

print("=" * 60)
print("Strategy 1: form-urlencoded (original)")
print("=" * 60)
h1 = {**base_headers, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"}
with httpx.Client(verify=False, timeout=15) as c:
    r = c.post(url, headers=h1, data={})
    show_result("Result", r)

print("\n" + "=" * 60)
print("Strategy 2: JSON with _sbmInfo")
print("=" * 60)
h2 = {**base_headers, "Content-Type": "application/json; charset=UTF-8"}
with httpx.Client(verify=False, timeout=15) as c:
    r = c.post(url, headers=h2, json={"_sbmInfo": {"debugMode": "false"}})
    show_result("Result", r)

print("\n" + "=" * 60)
print("Strategy 3: Session (GET page first, then POST)")
print("=" * 60)
with httpx.Client(verify=False, timeout=15, follow_redirects=True) as c:
    main_r = c.get(
        "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
        headers={"User-Agent": base_headers["User-Agent"], "Accept": "text/html"}
    )
    cookies = dict(c.cookies)
    print(f"Main page: {main_r.status_code}, cookies={list(cookies.keys())}")
    
    r = c.post(url, headers=h1, data={})
    show_result("Result", r)

print("\n" + "=" * 60)
print("Strategy 4: JSON + Session")
print("=" * 60)
with httpx.Client(verify=False, timeout=15, follow_redirects=True) as c:
    main_r = c.get(
        "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
        headers={"User-Agent": base_headers["User-Agent"], "Accept": "text/html"}
    )
    print(f"Main page: {main_r.status_code}")
    
    r = c.post(url, headers=h2, json={"_sbmInfo": {"debugMode": "false"}})
    show_result("Result", r)

print("\nDone.")
