
import asyncio
import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.db.session import async_session
from app.models.bets_db import ValuePickDB
from sqlalchemy import delete

async def clear_picks():
    async with async_session() as db:
        print("Clearing value_picks table...")
        await db.execute(delete(ValuePickDB))
        await db.commit()
        print("Cleared.")

if __name__ == "__main__":
    # Force load .env (just in case)
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(clear_picks())
