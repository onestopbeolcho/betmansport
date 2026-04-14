import asyncio
import os
import sys

# add backend path to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))
from dotenv import load_dotenv

load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend/.env")))

from app.services.buffer_service import buffer_service

async def main():
    print(f"Token present? {buffer_service.is_configured}")
    res = await buffer_service.publish_post(
        text="This is a test post for debugging. Please ignore. https://scorenix.com/predictions/ARS_MUN",
        now=True
    )
    print("Publish result:", res)

if __name__ == "__main__":
    asyncio.run(main())
