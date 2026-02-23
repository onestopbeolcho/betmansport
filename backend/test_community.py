
import httpx
import asyncio
import sys
import json

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

async def test_community():
    base_url = "http://localhost:8000/api/community"
    match_id = "ManCity_Liverpool"
    user_id = "tester_01"
    
    print(f"Testing Community API at: {base_url}\n")
    
    async with httpx.AsyncClient() as client:
        # 1. Vote
        print("--- 1. Submit Vote (Home) ---")
        vote_payload = {"match_id": match_id, "user_id": user_id, "selection": "Home"}
        res = await client.post(f"{base_url}/vote", json=vote_payload)
        if res.status_code == 200:
            print("Vote Success:", res.json())
        else:
            print("Vote Failed:", res.status_code, res.text)
            
        # 2. Check Stats
        print("\n--- 2. Get Stats ---")
        res = await client.get(f"{base_url}/stats/{match_id}")
        if res.status_code == 200:
            print("Stats:", res.json())
        else:
            print("Get Stats Failed:", res.status_code)

        # 3. Post Comment
        print("\n--- 3. Post Comment ---")
        comment_payload = {"match_id": match_id, "user_id": user_id, "content": "Man City wins easily!"}
        res = await client.post(f"{base_url}/comment", json=comment_payload)
        if res.status_code == 200:
            print("Comment Post Success:", res.json())
        else:
            print("Comment Post Failed:", res.status_code)

        # 4. Get Comments
        print("\n--- 4. Get Comments ---")
        res = await client.get(f"{base_url}/comments/{match_id}")
        if res.status_code == 200:
            comments = res.json()
            print(f"Retrieved {len(comments)} comments.")
            if comments:
                print("First Comment:", comments[0]['content'])
        else:
            print("Get Comments Failed:", res.status_code)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_community())
