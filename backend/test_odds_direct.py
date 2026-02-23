
import sys
import os
import asyncio
import logging

LOG_FILE = "simple_result.log"

def log(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")
    print(msg) # still print for console if needed

# Clear log file
open(LOG_FILE, "w").close()

try:
    # Add current directory to path so 'app' package can be found
    sys.path.append(os.getcwd())
    os.environ["PINNACLE_API_KEY"] = "mock_key"
    from app.api.endpoints.odds import get_positive_ev_bets
except Exception as e:
    log(f"Import Error: {e}")
    sys.exit(1)

async def test_endpoint():
    log("--- Testing /bets endpoint logic ---")
    try:
        # We need to capture the print() statements inside odds.py too?
        # No, those print directly to stdout. We won't see them in this file unless we redirect.
        # But let's see if the end result works.
        
        bets = await get_positive_ev_bets()
        
        log(f"--- Result ---")
        log(f"Found {len(bets)} value bets.")
        
        if len(bets) > 0:
            log("SUCCESS: Value bets generated.")
        else:
            log("WARNING: No value bets found.")
            
    except Exception as e:
        log(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_endpoint())
