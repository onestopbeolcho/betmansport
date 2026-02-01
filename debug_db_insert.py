import asyncio
from app.db.session import AsyncSessionLocal
from app.models.bets_db import ValuePickDB

async def debug_insert():
    print(">>> Debugging DB Insert...")
    async with AsyncSessionLocal() as db:
        try:
            pick = ValuePickDB(
                match_name="Debug Match vs Debug Team",
                bet_type="Home",
                domestic_odds=2.0,
                pinnacle_odds=1.8,
                true_probability=0.55,
                expected_value=1.1,
                kelly_pct=0.1
            )
            db.add(pick)
            await db.commit()
            print(">>> Insert Successful!")
            
            from sqlalchemy.future import select
            result = await db.execute(select(ValuePickDB).limit(1))
            print(f">>> Select Result: {result.scalars().first().match_name}")

        except Exception as e:
            print(f"FAILED: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    import sys, os
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    asyncio.run(debug_insert())
