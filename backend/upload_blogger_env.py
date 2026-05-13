import os
import sys

# 백엔드 루트를 시스템 패스에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.models.config_db import update_system_config
import asyncio

async def upload():
    keys = {
        "blogger_blog_id": os.getenv("BLOGGER_BLOG_ID"),
        "google_client_id": os.getenv("BLOGGER_CLIENT_ID"),
        "google_client_secret": os.getenv("BLOGGER_CLIENT_SECRET"),
        "google_refresh_token": os.getenv("BLOGGER_REFRESH_TOKEN"),
    }
    
    # Filter out empty
    keys = {k: v for k, v in keys.items() if v}
    
    if keys:
        print(f"Uploading keys to Firestore: {list(keys.keys())}")
        await update_system_config(keys)
        print("Upload complete!")
    else:
        print("No Blogger keys found in .env!")

if __name__ == "__main__":
    asyncio.run(upload())
