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

async def test_channels_query():
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    query = """
    query GetChannels {
        account {
            id
            organizations {
                id
                name
                channels {
                    id
                    name
                    service
                    avatar
                }
            }
        }
    }
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("https://api.buffer.com", headers=headers, json={"query": query})
            print(f"GraphQL Status: {resp.status_code}")
            print(f"GraphQL Response: {resp.text}")
        except Exception as e:
            print(f"GraphQL Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_channels_query())
