
import asyncio
import logging
from app.services.crawler_betman import BetmanCrawler

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ManualTest")

async def test_crawler():
    print("--- Starting Betman Crawler Test ---")
    crawler = BetmanCrawler()
    
    # Run synchronous fetch in async loop (since fetch_odds is sync in the file I saw, 
    # but let's double check if it's sync or async. 
    # looking at file content: fetch_odds is def fetch_odds(self), so it is synchronous.)
    
    try:
        items = crawler.fetch_odds()
        print(f"--- Fecth Complete ---")
        print(f"Total Items: {len(items)}")
        
        real_count = 0
        mock_count = 0
        
        for item in items:
            if "Mock" in item.provider:
                mock_count += 1
            else:
                real_count += 1
                
        print(f"Real Items: {real_count}")
        print(f"Mock Items: {mock_count}")
        
        if real_count > 0:
            print("SUCCESS: Real data fetched!")
            print(f"Sample: {items[0]}")
        else:
            print("FAILURE: Only mock data returned.")
            
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_crawler()
