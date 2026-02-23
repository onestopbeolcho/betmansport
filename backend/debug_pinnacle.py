import asyncio
import logging
from app.services.pinnacle_api import pinnacle_service

# Configure logging
logging.basicConfig(level=logging.INFO)

async def test_fetch():
    print("Testing fetch_odds (Real API)...")
    # Set the key manually for testing
    pinnacle_service.set_api_key("3fb45254446917d89ec85bdb012bd4d3")
    
    # This will skip DB cache and try API.
    items = await pinnacle_service.fetch_odds(db=None)
    
    print(f"Fetched {len(items)} items.")
    for item in items[:20]:
        print(f"[{item.sport}] {item.league}: {item.team_home} vs {item.team_away} ({item.home_odds}/{item.draw_odds}/{item.away_odds})")

    if len(items) == 0:
        print("WARNING: No items returned!")
        # Debug raw structure if empty
        # await debug_raw()

if __name__ == "__main__":
    asyncio.run(test_fetch())
