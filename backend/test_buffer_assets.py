import asyncio
import os
import httpx
import json
import uuid

from app.models.config_db import load_config_to_env
load_config_to_env()

token = os.environ.get("BUFFER_ACCESS_TOKEN", "")

async def run():
    print("Testing Buffer GraphQL AssetsInput...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    
    ch_ig = "69c074d0af47dacb6944d570"
    
    mutation = """
    mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) {
            ... on PostActionSuccess {
                post { id text status }
            }
            ... on MutationError {
                message
            }
        }
    }
    """
    
    # URL using `assets` -> `images` -> `url` or `photo`
    for img_key in ["url", "photo", "link"]:
        print(f"\n--- Trying Asset: {img_key} ---")
        post_input = {
            "text": f"[Scorenix Test] Asset Key test ({img_key}): {str(uuid.uuid4())[:8]}",
            "channelId": ch_ig,
            "schedulingType": "automatic",
            "mode": "shareNow",
            "metadata": {"instagram": {"type": "post", "shouldShareToFeed": True}},
            "assets": {"images": [{img_key: "https://scorenix.com/sns/preview/football.jpg"}]}
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post("https://api.buffer.com/", headers=headers, json={"query": mutation, "variables": {"input": post_input}})
            data = res.json()
            if "errors" in data:
                print("Error:", data["errors"][0].get("message", "unknown"))
            else:
                resp_data = data.get("data", {}).get("createPost", {})
                if "message" in resp_data:
                    print("MutationError:", resp_data["message"])
                else:
                    print("Success! Post created.")
                    print(json.dumps(resp_data, indent=2))
                    break

if __name__ == '__main__':
    asyncio.run(run())
