import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db

async def main():
    db = get_firestore_db()
    
    # Check betman_cache
    print("=== Checking betman_cache ===")
    docs = db.collection("betman_cache").limit(1).stream()
    for doc in docs:
        print(f"Doc ID: {doc.id}")
        import json
        print(json.dumps(doc.to_dict(), indent=2, ensure_ascii=False))
        
    # Check betman_rounds
    print("\n=== Checking betman_rounds ===")
    docs2 = db.collection("betman_rounds").order_by("crawled_at", direction="DESCENDING").limit(1).stream()
    for doc in docs2:
        print(f"Doc ID: {doc.id}")
        data = doc.to_dict()
        print(f"Crawled At: {data.get('crawled_at')}, Match Count: {len(data.get('matches', []))}")
        if data.get('matches'):
            print("First Match:")
            print(json.dumps(data['matches'][0], indent=2, ensure_ascii=False))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
