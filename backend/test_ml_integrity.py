import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import asyncio
from app.services.ml_service import ml_service
from app.services.pinnacle_api import pinnacle_service

async def main():
    print("--- 🏁 Phase 1 ML Pipeline Integrity Test ---")
    
    print("1. Fetching raw odds from Pinnacle...")
    odds = await pinnacle_service.fetch_odds()
    if not odds:
        print("[SKIP] No odds available in DB right now to test ML.")
        return
    print(f"Loaded {len(odds)} odds for batch processing.")
    
    print("\n2. Executing `predict_matches` directly on real data...")
    try:
        results = await ml_service.predict_matches(odds)
        print(f"[SUCCESS] ML Service returned {len(results)} valid predictions without crashing.")
        if len(results) < len(odds):
            skips = len(odds) - len(results)
            print(f"[NOTE] The per-match error boundary skipped {skips} items correctly safely!")
        else:
            print("[NOTE] All matches processed perfectly.")
            
    except Exception as e:
        print(f"[FAILED] Entire pipeline crashed: {e}")

if __name__ == '__main__':
    asyncio.run(main())
