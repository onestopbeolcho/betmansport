
import sys
import os
import logging
import traceback
import json

# Add current directory to path so 'app' can be found
sys.path.append(os.getcwd())

from app.services.crawler_betman import BetmanCrawler

# Setup Logging to file to avoid console issues
logging.basicConfig(level=logging.INFO, filename="test_betman.log", filemode="w")
logger = logging.getLogger("ManualTest")

def test_crawler():
    result_file = "test_betman_result.txt"
    with open(result_file, "w", encoding="utf-8") as f:
        f.write("--- Starting Betman Crawler Test ---\n")
        
        crawler = BetmanCrawler()
        
        try:
            items = crawler.fetch_odds()
            f.write(f"--- Fetch Complete ---\n")
            f.write(f"Total Items: {len(items)}\n")
            
            real_count = 0
            mock_count = 0
            
            # Specific Mock Detection
            mock_timestamp = "2026-02-10T19:00:00Z"
            mock_home_team = "맨체스터 시티"
            
            for item in items:
                # Check for specific mock values
                if item.match_time == mock_timestamp and item.team_home_ko == mock_home_team:
                    mock_count += 1
                elif item.league == "EPL" and item.team_home == "Man City": # Redundant check
                    mock_count += 1
                else:
                    real_count += 1
            
            f.write(f"Real Items: {real_count}\n")
            f.write(f"Mock Items: {mock_count}\n")
            
            if real_count > 0:
                f.write("SUCCESS: Real data fetched!\n")
                # write first item as JSON string for inspection
                f.write(f"Sample: {item.json()}\n") 
            else:
                f.write("FAILURE: Only mock data returned.\n")
                
        except Exception as e:
            f.write(f"CRITICAL ERROR: {e}\n")
            traceback.print_exc(file=f)

if __name__ == "__main__":
    test_crawler()
