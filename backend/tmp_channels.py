import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("."))
from dotenv import load_dotenv

load_dotenv(".env")
from app.services.buffer_service import buffer_service

async def query_channels():
    channels = await buffer_service.get_channels()
    for ch in channels:
        print(f"ID: {ch['id']}, Service: {ch['service']}, Name: {ch.get('name', 'N/A')}")

asyncio.run(query_channels())
