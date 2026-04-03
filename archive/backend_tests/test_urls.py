
import sys
import os
import logging
import httpx

# Add current directory to path so 'app' can be found
sys.path.append(os.getcwd())

logging.basicConfig(level=logging.INFO, filename="test_urls.log", filemode="w")

def test_urls():
    urls = [
        "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
        "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
    }

    with open("test_urls_result.txt", "w", encoding="utf-8") as f:
        for url in urls:
            try:
                f.write(f"Testing URL: {url}\n")
                resp = httpx.get(url, headers=headers, timeout=10.0, verify=False)
                f.write(f"Status: {resp.status_code}\n")
                f.write(f"Content Type: {resp.headers.get('content-type')}\n")
                f.write(f"Preview: {resp.text[:500]}\n")
                f.write("-" * 50 + "\n")
            except Exception as e:
                f.write(f"Error fetching {url}: {e}\n")

if __name__ == "__main__":
    test_urls()
