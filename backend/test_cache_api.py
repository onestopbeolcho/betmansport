"""Test the cache API directly"""
import requests
import json

url = "https://www.betman.co.kr/buyPsblGame/inqCacheBuyAbleGameInfoList.do"

headers = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
    "Origin": "https://www.betman.co.kr",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json; charset=UTF-8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

payload = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}

print("Testing Cache API...")
print(f"URL: {url}\n")

response = requests.post(url, headers=headers, json=payload, timeout=15)

print(f"Status: {response.status_code}")
print(f"Content-Type: {response.headers.get('Content-Type', 'N/A')}")
print(f"Length: {len(response.content)} bytes\n")

if response.status_code == 200:
    try:
        data = response.json()
        
        # Save full response for inspection
        with open("cache_api_full.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("✅ Full response saved to cache_api_full.json")
        
        print("✅ JSON 파싱 성공!")
        print(f"Keys: {list(data.keys())}\n")
        
        # Check for games
        game_list = data.get("gameList", [])
        print(f"총 {len(game_list)}개 게임 타입 발견:\n")
        
        for game in game_list:
            gm_id = game.get("gmId", "N/A")
            gm_nm = game.get("gmNm", "N/A")
            rounds = game.get("lists", [])
            print(f"  [{gm_id}] {gm_nm} — {len(rounds)}개 회차")
            
            for r in rounds[:2]:  # Show first 2 rounds
                gm_ts = r.get("gmTs", "N/A")
                main_state = r.get("mainState", "N/A")
                print(f"    • 회차: {gm_ts}, 상태: {main_state}")
    except Exception as e:
        print(f"❌ JSON 파싱 실패: {e}")
        print(response.text[:500])
else:
    print(f"❌ 요청 실패")
    print(response.text[:500])
