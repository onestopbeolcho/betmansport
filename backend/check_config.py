import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.db.firestore import get_firestore_db

async def main():
    print("=== Checking system_config/main_config ===")
    db = get_firestore_db()
    
    doc_ref = db.collection("system_config").document("main_config")
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        print("Found system_config/main_config. Available keys:")
        for k, v in data.items():
            if v:
                # Mask key
                masked = v[:4] + "..." + v[-4:] if len(str(v)) > 8 else "len:" + str(len(str(v)))
                print(f"  - {k}: {masked}")
            else:
                print(f"  - {k}: (Empty/None)")
    else:
        print("system_config/main_config does not exist!")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
