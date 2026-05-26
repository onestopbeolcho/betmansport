import sys
sys.stdout.reconfigure(encoding='utf-8')

import asyncio
import os
import firebase_admin
from firebase_admin import credentials, firestore

PROJECT_ID = "smart-proto-inv-2026"
cred_path = "../smart-proto-inv-2026-firebase-adminsdk-fbsvc-8067fa1f84.json"

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    db = firestore.client()
    
    # Load Firestore system_config
    config_doc = db.collection("system_config").document("main_config").get()
    if config_doc.exists:
        config_data = config_doc.to_dict()
        # Set all environment variables mapped from Firestore
        from app.models.config_db import load_config_to_env
        load_config_to_env()
        print("🔑 Injected all environment variables from Firestore!")

from app.services.card_generator import generate_card_and_upload

async def main():
    test_match = {
        "match_id": "test_match_123",
        "team_home": "Heerenveen",
        "team_away": "Fortuna Sittard",
        "team_home_ko": "헤이렌베인",
        "team_away_ko": "포르튀나",
        "league": "Eredivisie",
        "confidence": 64.9,
        "recommendation": "HOME",
        "home_win_prob": 64.9,
        "draw_prob": 10.7,
        "away_win_prob": 24.5,
        "factors": [
            {"name": "배당률 내재 확률", "score": 64.9, "detail": ""}
        ]
    }
    print("\n🎬 Generating test match card and uploading to Firebase Storage...")
    url = await generate_card_and_upload(test_match)
    print(f"✅ Generated Card URL: {url}")
    
    if url:
        # Let's test if we can download the uploaded URL locally to verify it's public
        import urllib.request
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                content = response.read()
                print(f"   🔓 Verified Public Access: Success! Downloaded {len(content)} bytes.")
        except Exception as dl_e:
            print(f"   ❌ Access Blocked or Not Found: {dl_e}")

if __name__ == "__main__":
    asyncio.run(main())
