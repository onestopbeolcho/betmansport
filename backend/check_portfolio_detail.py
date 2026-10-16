import os
import sys
import datetime
from datetime import timezone

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db

async def main():
    db = get_firestore_db()
    today_str = datetime.datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    doc_ref = db.collection("daily_portfolios").document(today_str)
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        matches = data.get("matches", [])
        if matches:
            import json
            print("First Match Detail:")
            print(json.dumps(matches[0], indent=2, ensure_ascii=False))
        else:
            print("No matches in daily_portfolios today")
    else:
        print("daily_portfolios not found")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
