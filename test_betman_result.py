import httpx
import json

url = "https://www.betman.co.kr/gameResult/gameResultList.do"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Referer": "https://www.betman.co.kr/main/mainPage/gameResult/gameResultList.do",
    "Origin": "https://www.betman.co.kr",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Host": "www.betman.co.kr",
    "Connection": "keep-alive"
}

payload = {
    "gameGubun": "G101",
    "gameType": "G101",
    "startDt": "20240101",
    "endDt": "20240107",
    "pageIndex": "1",
    "_sbmInfo": {"debugMode": "false"}
}

try:
    with httpx.Client(verify=False, timeout=15.0) as client:
        # 1. Visit Main Page to get JSESSIONID / Cookies
        client.get("https://www.betman.co.kr/")
        
        # 2. Request Data
        resp = client.post(url, headers=headers, data=payload)
        
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            try:
                data = resp.json()
                print(json.dumps(data, indent=2, ensure_ascii=False)[:3000]) 
            except:
                print("Response is not JSON")
                print(resp.text[:1000])
except Exception as e:
    print(f"Error: {e}")
