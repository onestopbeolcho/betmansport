import httpx
import asyncio
import traceback

async def test_betman_connection():
    # Use EXACT headers that worked in test_betman_api.py (Step 1301)
    headers_api = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
        "Origin": "https://www.betman.co.kr",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        # Removed Host and Connection to avoid potential issues if they weren't needed
    }
    
    api_url = "https://www.betman.co.kr/buyPsblGame/inqBuyAbleGameInfoList.do"
    print(f"1. Discovering Active Round from {api_url}...")
    
    try:
        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            # 1. API Call (Direct POST)
            resp_api = await client.post(api_url, headers=headers_api, data={})
            
            if resp_api.status_code != 200:
                print(f"❌ API Failed: {resp_api.status_code}")
                # print(resp_api.text[:200])
                return
            
            if "text/html" in resp_api.headers.get("content-type", ""):
                 print("❌ Received HTML instead of JSON.")
                 # print(resp_api.text[:200])
                 return

            try:
                data = resp_api.json()
                print("✅ API JSON Decoded successfully.")
            except Exception as e:
                print(f"❌ JSON Decode Error: {e}")
                return

            gm_id = "G101" # Default to Proto Match
            gm_ts = None
            
            # Find G101
            if "protoGames" in data:
                for game in data.get("protoGames", []):
                    if game.get("gmId") == gm_id:
                        gm_ts = game.get("gmTs")
                        print(f"✅ Found Round: {gm_ts} (Game: {game.get('gameMaster', {}).get('gameNickName')})")
                        break
            
            # Fallback
            if not gm_ts and data.get("protoGames"):
                 gm_ts = data["protoGames"][0].get("gmTs")
                 gm_id = data["protoGames"][0].get("gmId")
                 print(f"⚠️ Fallback to found game: {gm_id} / {gm_ts}")

            if not gm_ts:
                print("❌ No valid game round found.")
                return

            # 2. Fetch Odds Page
            # We need standard browser headers for this GET request
            target_url = f"https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId={gm_id}&gmTs={gm_ts}"
            print(f"2. Fetching Odds Page: {target_url}")
            
            headers_page = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
                 "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            }
            
            resp_page = await client.get(target_url, headers=headers_page)
            
            if resp_page.status_code == 200:
                print("✅ Odds Page Fetch Successful!")
                with open("betman_odds.html", "w", encoding="utf-8") as f:
                    f.write(resp_page.text)
                print("Saved to betman_odds.html")
            else:
                print(f"❌ Failed to fetch odds page: {resp_page.status_code}")

    except Exception as e:
        print(f"An error occurred: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_betman_connection())
