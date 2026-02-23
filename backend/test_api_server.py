
import httpx
import asyncio
import sys

# Force UTF-8 encoding for stdout
sys.stdout.reconfigure(encoding='utf-8')

async def test_server():
    url = "http://localhost:8000/api/bets"
    print(f"Testing API at: {url}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Success! Received {len(data)} items.")
                if len(data) > 0:
                    first = data[0]
                    print(f"First Item: {first.get('match_name')} - EV: {first.get('expected_value')}")
                else:
                    print("Warning: Received empty list (but valid 200 OK).")
            else:
                print(f"Error: Server returned {response.status_code}")
                print(response.text)
                
    except Exception as e:
        print(f"Connection Error: {e}")
        print("Ensure the uvicorn server is running on port 8000.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_server())
