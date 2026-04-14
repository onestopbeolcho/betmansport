import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname("c:/Smart_Proto_Investor_Plan/"), "Smart_Proto_Investor_Plan/backend")))
from dotenv import load_dotenv

load_dotenv("c:/Smart_Proto_Investor_Plan/backend/.env")
from app.services.buffer_service import buffer_service

async def query_channels():
    channels = await buffer_service.core.get_channels()
    for ch in channels:
        print(f"ID: {ch['id']}, Service: {ch['service']}, Type: {ch.get('service_type', 'N/A')}, Name: {ch.get('name', 'N/A')}")

asyncio.run(query_channels())
