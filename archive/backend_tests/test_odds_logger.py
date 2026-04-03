
import sys
import os
import asyncio
import logging
from contextlib import redirect_stdout, redirect_stderr

# Add current directory to path so 'app' package can be found
sys.path.append(os.getcwd())
os.environ["PINNACLE_API_KEY"] = "mock_key"

try:
    from app.api.endpoints.odds import get_positive_ev_bets
except Exception as e:
    with open("test_odds_result.txt", "w", encoding="utf-8") as f:
        f.write(f"Import Error: {e}")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)

async def test_endpoint():
    with open("test_odds_result.txt", "w", encoding="utf-8") as f:
        with redirect_stdout(f), redirect_stderr(f):
            print("--- Testing /bets endpoint logic ---")
            try:
                bets = await get_positive_ev_bets()
                
                print(f"--- Result ---")
                print(f"Found {len(bets)} value bets.")
                
                if len(bets) > 0:
                    print("SUCCESS: Value bets generated.")
                    for i, bet in enumerate(bets):
                        print(f"[{i+1}] {bet.match_name}")
                        print(f"    Type: {bet.bet_type}")
                        print(f"    Odds: Local {bet.domestic_odds} / True {bet.pinnacle_odds}")
                        print(f"    EV: {bet.expected_value}")
                        print(f"    Kelly: {bet.kelly_pct}%")
                else:
                    print("WARNING: No value bets found. Check threshold or mock data values.")
                    
            except Exception as e:
                print(f"CRITICAL ERROR: {e}")
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_endpoint())
