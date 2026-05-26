import sys
sys.stdout.reconfigure(encoding='utf-8')

import asyncio
import os
import firebase_admin
from firebase_admin import credentials, firestore

# Set project ID and load firestore config
PROJECT_ID = "smart-proto-inv-2026"
cred_path = "smart-proto-inv-2026-firebase-adminsdk-fbsvc-8067fa1f84.json"

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    db = firestore.client()
    
    # Load Firestore system_config
    config_doc = db.collection("system_config").document("main_config").get()
    if config_doc.exists:
        config_data = config_doc.to_dict()
        buffer_token = config_data.get("BUFFER_ACCESS_TOKEN", "")
        if buffer_token:
            os.environ["BUFFER_ACCESS_TOKEN"] = buffer_token
            print("🔑 Successfully loaded BUFFER_ACCESS_TOKEN from Firestore!")
        else:
            print("❌ BUFFER_ACCESS_TOKEN not found in Firestore main_config")
    else:
        print("❌ Firestore main_config document not found")

# Initialize and query channels
from app.services.buffer_service import buffer_service

async def main():
    if not buffer_service.is_configured:
        print("❌ Buffer service not configured")
        return
        
    channels = await buffer_service.get_channels(force_refresh=True)
    print(f"\n📢 Found {len(channels)} active Buffer channels:")
    for ch in channels:
        print(f"  - ID: {ch['id']}")
        print(f"    Name: {ch['name']}")
        print(f"    Service: {ch['service']}")
        print(f"    Disabled: {ch['disabled']}")
        print("-" * 30)

if __name__ == "__main__":
    asyncio.run(main())
