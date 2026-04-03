import asyncio
from app.db.session import engine
from app.db.base import Base
# Import all models so Base.metadata knows about them
from app.models.bets_db import MarketCache, ValuePickDB, OddsHistoryDB
from app.models.user_db import UserDB, PaymentDB, BettingPortfolioDB, BettingSlipDB
from app.models.config_db import SystemConfigDB

async def create_tables():
    print("Creating tables...")
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # DANGEROUS: Do not uncomment in prod
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully!")

if __name__ == "__main__":
    import sys
    import os
    # Add backend directory to sys.path so imports work
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    asyncio.run(create_tables())
