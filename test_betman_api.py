import httpx
import asyncio
import traceback

async def test_betman_api():
    url = "https://www.betman.co.kr/buyPsblGame/inqBuyAbleGameInfoList.do"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
        "Origin": "https://www.betman.co.kr",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Host": "www.betman.co.kr",
        "Connection": "keep-alive"
    }
    
    # Try sending empty data first as seen in the JS (params = {})
    data = {}

    print(f"POSTing to {url}...")
    try:
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(url, headers=headers, data=data)
            
            print(f"Status Code: {response.status_code}")
            if response.status_code == 200:
                try:
                    json_data = response.json()
                    print("✅ API Call Successful!")
                    # Check for protoGames
                    if "protoGames" in json_data:
                        games = json_data["protoGames"]
                        print(f"Found {len(games)} proto games.")
                        if games:
                            first_game = games[0]
                            print(f"Sample Game: {first_game.get('gameMaster', {}).get('gameNickName')} | ID: {first_game.get('gmId')} | Round: {first_game.get('gmTs')}")
                            print(f"Constructed URL: https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do?frameType=typeA&gmId={first_game.get('gmId')}&gmTs={first_game.get('gmTs')}")
                    else:
                        print("Keys found:", json_data.keys())
                except Exception as e:
                    print(f"Failed to parse JSON: {e}")
                    print(response.text[:500])
            else:
                print("Failed.")
                print(response.text[:500])
                
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_betman_api())
