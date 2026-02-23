from app.db.firestore import get_firestore_db

CONFIG_COLLECTION = "system_config"
CONFIG_DOC_ID = "main_config"

async def get_system_config():
    try:
        db = get_firestore_db()
        doc = db.collection(CONFIG_COLLECTION).document(CONFIG_DOC_ID).get()
        if doc.exists:
            return doc.to_dict()
    except Exception:
        pass
    return {}

async def update_system_config(data: dict):
    db = get_firestore_db()
    db.collection(CONFIG_COLLECTION).document(CONFIG_DOC_ID).set(data, merge=True)
    return data
