import requests
import json
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("betman_test")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def test_betman_connection():
    session = requests.Session()
    session.verify = False
    session.headers.update({"User-Agent": UA})
    
    # 1. Main Page
    logger.info("Testing Main Page...")
    try:
        resp = session.get("https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do", timeout=10)
        logger.info(f"Main Page Status: {resp.status_code}")
        logger.info(f"Cookies: {session.cookies.get_dict()}")
    except Exception as e:
        logger.error(f"Main Page Failed: {e}")
        return

    # 2. Discovery API
    logger.info("Testing Discovery API...")
    url = "https://www.betman.co.kr/buyPsblGame/inqBuyAbleGameInfoList.do"
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.betman.co.kr/main/mainPage/gamebuy/buyableGameList.do",
    }
    payload = {"_sbmInfo": {"_sbmInfo": {"debugMode": "false"}}}
    
    try:
        resp = session.post(url, headers=headers, json=payload, timeout=10)
        logger.info(f"Discovery Status: {resp.status_code}")
        logger.info(f"Content-Type: {resp.headers.get('content-type')}")
        
        if "application/json" in resp.headers.get("content-type", ""):
            data = resp.json()
            logger.info("Discovery Succeeded!")
            # Print a bit of data
            if "protoGames" in data:
                logger.info(f"Found {len(data['protoGames'])} proto games.")
            else:
                logger.warning("No protoGames in response.")
        else:
            logger.error("Discovery returned non-JSON response.")
            logger.error(f"Response snippet: {resp.text[:500]}")
            
    except Exception as e:
        logger.error(f"Discovery Failed: {e}")

if __name__ == "__main__":
    test_betman_connection()
