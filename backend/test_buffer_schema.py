import asyncio
import os
import httpx
import json

from app.models.config_db import load_config_to_env
load_config_to_env()

token = os.environ.get("BUFFER_ACCESS_TOKEN", "")

async def run():
    print("Fetching GraphQL Schema for CreatePostInput...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    query = """
    query IntrospectAssetsInput {
      __type(name: "AssetsInput") {
        name
        inputFields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
              ofType { name kind }
            }
          }
        }
      }
    }
    """
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post("https://api.buffer.com/", headers=headers, json={"query": query})
        print(f"Status: {res.status_code}")
        try:
            print(json.dumps(res.json(), indent=2))
        except:
            print(res.text)

if __name__ == '__main__':
    asyncio.run(run())
