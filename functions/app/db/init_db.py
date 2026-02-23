import asyncio
from app.db.session import engine
from app.db.base import Base
# Import models so they are registered with Base metadata
from app.models.config_db import SystemConfigDB
from app.models.bets_db import ValuePickDB, OddsHistoryDB

async def init_models():
    async with engine.begin() as conn:
        print(">>> Creating Tables...")
        await conn.run_sync(Base.metadata.drop_all) # Clean start for DEV
        await conn.run_sync(Base.metadata.create_all)
        print(">>> Tables Created!")

if __name__ == "__main__":
    asyncio.run(init_models())
