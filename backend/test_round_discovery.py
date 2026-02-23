
import sys
import os
import logging
import httpx
import re

# Add current directory to path so 'app' can be found
sys.path.append(os.getcwd())

def test_urls():
    urls = [
        "https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do",
        "https://www.betman.co.kr/main/mainPage.do"
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
    }

    with open("test_round_discovery.txt", "w", encoding="utf-8") as f:
        for url in urls:
            try:
                f.write(f"Testing URL: {url}\n")
                resp = httpx.get(url, headers=headers, timeout=10.0, verify=False)
                f.write(f"Status: {resp.status_code}\n")
                
                # Search for gmTs pattern (usually numeric)
                # var gmTs = "240015"; or <input ... value="240015">
                # specific pattern: gmTs\s*[:=]\s*["']?(\d+)["']?
                
                matches = re.findall(r'gmTs\s*[:=]\s*["\']?(\d+)["\']?', resp.text)
                if matches:
                    f.write(f"Found gmTs via Regex: {matches}\n")
                else:
                    f.write("No gmTs found via Regex.\n")
                    
                # Search for gmId
                matches_id = re.findall(r'gmId\s*[:=]\s*["\']?(G\d+)["\']?', resp.text)
                if matches_id:
                     f.write(f"Found gmId via Regex: {matches_id}\n")
                     
                f.write("-" * 50 + "\n")
            except Exception as e:
                f.write(f"Error fetching {url}: {e}\n")

if __name__ == "__main__":
    test_urls()
