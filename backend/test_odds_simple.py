
import sys
import os
import asyncio
import logging

try:
    # Add current directory to path so 'app' package can be found
    sys.path.append(os.getcwd())
    os.environ["PINNACLE_API_KEY"] = "mock_key"
    from app.api.endpoints.odds import get_positive_ev_bets
except Exception as e:
    print(f"Import Error: {e}")
    sys.exit(1)

async def test_endpoint():
    print("--- Testing /bets endpoint logic ---")
    try:
        bets = await get_positive_ev_bets()
        
        print(f"--- Result ---")
        print(f"Found {len(bets)} value bets.")
        
        if len(bets) > 0:
            print("SUCCESS: Value bets generated.")
        else:
            print("WARNING: No value bets found.")
            
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_endpoint())
