import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import asyncio
from app.services.soccer_stats_service import soccer_stats_service

async def main():
    teams = ["Manchester United", "Real Madrid", "Bayern Munich", "Juventus"]
    stats = await soccer_stats_service.fetch_team_stats(teams)
    print("Fetched Stats:")
    for t, data in stats.items():
        print(f"Team: {t}")
        print(f"  xG For: {data.get('avg_xG_for')}")
        print(f"  xG Against: {data.get('avg_xG_against')}")
        print(f"  Form Index: {data.get('form_index')}")
        
if __name__ == "__main__":
    asyncio.run(main())
