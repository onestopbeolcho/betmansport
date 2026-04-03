import httpx
import asyncio

async def test_network():
    try:
        async with httpx.AsyncClient(verify=False) as client:
            resp = await client.get("https://www.google.com")
            print(f"Google Status: {resp.status_code}")
    except Exception as e:
        print(f"Network Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_network())
