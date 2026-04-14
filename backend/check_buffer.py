import asyncio
from app.services.buffer_service import buffer_service

async def main():
    print(f"Is configured: {buffer_service.is_configured}")
    if buffer_service.is_configured:
        channels = await buffer_service.get_channels()
        print(f"Channels: {channels}")
        posts = await buffer_service.get_recent_posts(limit=3)
        print(f"Recent posts: {posts}")

if __name__ == "__main__":
    asyncio.run(main())
