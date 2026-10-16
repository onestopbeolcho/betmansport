import os
import sys
import asyncio
import httpx

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.models.config_db import load_config_to_env
load_config_to_env()

token = os.getenv("BUFFER_ACCESS_TOKEN", "")
print(f"Token present: {bool(token)}")
if token:
    print(f"Token: {token[:6]}...{token[-6:] if len(token) > 12 else ''}")

async def test_raw():
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    # 1. Test REST API (List profiles)
    print("\n--- Testing REST API (GET /profiles.json) ---")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get("https://api.bufferapp.com/1/profiles.json", headers=headers)
            print(f"REST Status: {resp.status_code}")
            print(f"REST Response: {resp.text[:500]}")
        except Exception as e:
            print(f"REST Request failed: {e}")

    # 2. Test GraphQL API
    print("\n--- Testing GraphQL API (POST https://api.buffer.com) ---")
    query = """
    query GetChannels {
        account {
            id
        }
    }
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("https://api.buffer.com", headers=headers, json={"query": query})
            print(f"GraphQL Status: {resp.status_code}")
            print(f"GraphQL Response: {resp.text[:500]}")
        except Exception as e:
            print(f"GraphQL Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_raw())
