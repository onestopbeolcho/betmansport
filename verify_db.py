import asyncio
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.bets_db import ValuePickDB
from app.models.config_db import SystemConfigDB
from app.db.session import engine

# Ensure backend directory is in python path (handled by invocation)

async def verify_db():
    print(f">>> Verifying Database Persistence using: {engine.url}")
    print(">>> Verifying Database Persistence...")
    
    async with AsyncSessionLocal() as session:
        # 1. Check Config Table
        result = await session.execute(select(SystemConfigDB))
        config = result.scalars().first()
        print(f"Current Config Exists: {config is not None}")
        if config:
            print(f"  API Key: {config.pinnacle_api_key}")
        else:
            print("  NO Config found.")
            
        # 2. Check Bets Table (Should be empty initially or have data if API was hit)
        result = await session.execute(select(ValuePickDB))
        bets = result.scalars().all()
        print(f"Value Bets Count: {len(bets)}")
        
        for bet in bets:
            print(f"  - {bet.match_name}: EV {bet.expected_value} (Status: {bet.result})")

if __name__ == "__main__":
    import sys, os
    # Add backend to path if running directly
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    asyncio.run(verify_db())
