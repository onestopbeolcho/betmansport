import asyncio
import os
import httpx
import json

from app.models.config_db import load_config_to_env
load_config_to_env()

token = os.environ.get("BUFFER_ACCESS_TOKEN", "")

async def run():
    print("Testing Buffer raw REST request...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    
    # 1. Get channel IDs via GraphQL (we know they are 69c074d0af47dacb6944d570 and 69c0ab99af47dacb69457f18)
    ch_ig = "69c074d0af47dacb6944d570"
    ch_fb = "69c0ab99af47dacb69457f18"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test Instagram with REST API
        print("\n--- Publishing to Instagram via REST ---")
        data = {
            "profile_ids[]": ch_ig,
            "text": "[Scorenix] REST API Image Upload Test. " + str(os.urandom(4).hex()), # Randomize to avoid duplicate error
            "media[photo]": "https://scorenix.com/sns/preview/football.jpg",
            "now": "true"
        }
        res_ig = await client.post("https://api.bufferapp.com/1/updates/create.json", headers=headers, data=data)
        print(f"Status: {res_ig.status_code}")
        try:
            print(json.dumps(res_ig.json(), indent=2))
        except:
            print(res_ig.text)

        # Test Facebook with REST API
        print("\n--- Publishing to Facebook via REST ---")
        data_fb = {
            "profile_ids[]": ch_fb,
            "text": "[Scorenix] REST API FB Upload Test. " + str(os.urandom(4).hex()),
            "now": "true",
            "media[photo]": "https://scorenix.com/sns/preview/football.jpg"
        }
        res_fb = await client.post("https://api.bufferapp.com/1/updates/create.json", headers=headers, data=data_fb)
        print(f"Status: {res_fb.status_code}")
        try:
            print(json.dumps(res_fb.json(), indent=2))
        except:
            print(res_fb.text)

if __name__ == '__main__':
    asyncio.run(run())
