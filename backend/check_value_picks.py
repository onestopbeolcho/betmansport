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
    today = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    print(f"Checking value_picks from today KST/UTC: {today.isoformat()}")
    docs = db.collection("value_picks") \
        .where("created_at", ">=", today.isoformat()) \
        .stream()
        
    count = 0
    for doc in docs:
        count += 1
        data = doc.to_dict()
        print(f"  {count}. Match: {data.get('match_name')}, Type: {data.get('bet_type')}, EV: {data.get('expected_value')}")
        
    if count == 0:
        print("No value_picks found for today.")
        
        # Check all value_picks (recent 5)
        print("\nChecking recent 5 value_picks overall:")
        all_docs = db.collection("value_picks") \
            .order_by("created_at", direction="DESCENDING") \
            .limit(5) \
            .stream()
        for idx, doc in enumerate(all_docs):
            data = doc.to_dict()
            print(f"  {idx+1}. [{data.get('created_at')}] Match: {data.get('match_name')}, Type: {data.get('bet_type')}, EV: {data.get('expected_value')}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
