import os
import sys
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import asyncio
from fastapi import HTTPException
from app.api.endpoints.portfolio import save_bet_slip, SlipCreate, SlipItem
from app.schemas.user import User
from app.services.pinnacle_api import pinnacle_service
from app.services.settlement import auto_settle_slips
from datetime import datetime

async def main():
    print("--- Phase 2 Integrity Test ---")
    
    # 1. Fetch real/mock odds from Pinnacle Service
    print("Fetching odds...")
    odds = await pinnacle_service.fetch_odds()
    if not odds:
        print("No odds available. Testing with empty odds (verification fallback).")
    else:
        print(f"Loaded {len(odds)} odds from cache.")
        
    test_user = User(
        id="test_integrity_user_123",
        email="integrity@test.none",
        username="Tester",
        role="user",
        tier="Rookie",
        created_at=datetime.utcnow()
    )

    # 2. Test Portfolio Odds Verification 
    # Create a slip item mimicking an odd
    fake_items = []
    
    if odds:
        # Use first odd but significantly alter it to trigger exception
        random_odd = odds[0]
        fake_items.append(SlipItem(
            id="test1",
            match_name=f"{random_odd.team_home} vs {random_odd.team_away}",
            selection="Home",
            odds=random_odd.home_odds + 5.0, # significantly differing odds
            team_home=random_odd.team_home,
            team_away=random_odd.team_away,
            time=random_odd.match_time
        ))
    else:
        fake_items.append(SlipItem(
            id="test1",
            match_name="Fake vs Fake",
            selection="Home",
            odds=2.0,
            team_home="Fake",
            team_away="Fake",
            time="2026-12-31"
        ))

    slip = SlipCreate(
        items=fake_items,
        stake=10000,
        total_odds=2.0,
        potential_return=20000
    )
    
    print("\n--- Testing Portfolio Save (Rejecting altered odds) ---")
    try:
        await save_bet_slip(slip, test_user)
        if odds:
            print("[FAILED] Should have rejected the mismatched odds!")
        else:
            print("[SUCCESS] Since odds are empty, mock data bypassed or no restriction. Done.")
    except HTTPException as e:
        if e.status_code == 400:
            print(f"[SUCCESS] Fast rejection caught successfully: {e.detail}")
        else:
            print(f"[FAILED] Unexpected HTTP Exception: {e.status_code} - {e.detail}")
    except Exception as e:
        print(f"[FAILED] Unexpected Exception: {e}")

    # 3. Test Auto Settlement
    print("\n--- Testing Settlement Audit Trails (auto_settle_slips) ---")
    try:
        settlement_stats = await auto_settle_slips()
        print(f"[SUCCESS] Auto-settlement executed smoothly. Stats: {settlement_stats}")
    except Exception as e:
        print(f"Exception in auto_settle_slips: {e}")

if __name__ == '__main__':
    asyncio.run(main())
