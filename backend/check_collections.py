import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db

async def main():
    db = get_firestore_db()
    collections = db.collections()
    print("=== Firestore Collections ===")
    for col in collections:
        print(f" - {col.id}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
