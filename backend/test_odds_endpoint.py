
import sys
import os
import asyncio
import logging

# Add current directory to path so 'app' package can be found
# Assuming we run this from c:\Smart_Proto_Investor_Plan\backend
sys.path.append(os.getcwd())

# Mock environment variables if needed
os.environ["PINNACLE_API_KEY"] = "mock_key"

try:
    from app.api.endpoints.odds import get_positive_ev_bets
except ImportError as e:
    print(f"Import Error: {e}")
    print(f"Current Path: {sys.path}")
    print(f"CWD: {os.getcwd()}")
    sys.exit(1)

# Setup logging
logging.basicConfig(level=logging.INFO)

async def test_endpoint():
    print("--- Testing /bets endpoint logic ---")
    try:
        # Call the endpoint function directly (it's an async function)
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
