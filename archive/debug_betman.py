
import httpx
import re

def debug_betman():
    base_url = "https://www.betman.co.kr"
    list_url = "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "https://www.betman.co.kr/",
        "Connection": "keep-alive"
    }
    
    try:
        print(f"Fetching {list_url} ...")
        with httpx.Client(verify=False, timeout=20.0, follow_redirects=True) as client:
            resp = client.get(list_url, headers=headers)
            print(f"Status: {resp.status_code}")
            
            with open("betman_list.html", "w", encoding="utf-8") as f:
                f.write(resp.text)
            
            print("Successfully saved betman_list.html")
            
            # Search matches again
            matches = re.findall(r"gmId=(G101)&gmTs=(\d+)", resp.text)
            print(f"List Page Regex: {matches}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_betman()
