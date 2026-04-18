from datetime import datetime
import logging
import os
import json

logger = logging.getLogger(__name__)

# Collection Names
USERS_COLLECTION = "users"
PAYMENTS_COLLECTION = "payments"
PORTFOLIO_COLLECTION = "portfolio"

# --- Local JSON fallback for development ---
_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
_USERS_FILE = os.path.join(_DATA_DIR, "users.json")


def _is_firestore_available() -> bool:
    try:
        from app.db.firestore import get_firestore_db
        get_firestore_db()
        return True
    except Exception:
        return False


def _load_local_users() -> list:
    try:
        if os.path.exists(_USERS_FILE):
            with open(_USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return []


def _save_local_users(users: list):
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, default=str)


# --- User Helpers ---
async def get_user_by_email(email: str):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            docs = db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).stream()
            for doc in docs:
                return {**doc.to_dict(), "id": doc.id}
            return None
        except Exception:
            pass

    # Local fallback
    users = _load_local_users()
    for u in users:
        if u.get("email") == email:
            return u
    return None


async def get_user_by_id(user_id: str):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            doc_ref = db.collection(USERS_COLLECTION).document(user_id)
            doc = doc_ref.get()
            if doc.exists:
                return {**doc.to_dict(), "id": doc.id}
            return None
        except Exception:
            pass

    # Local fallback
    users = _load_local_users()
    for u in users:
        if u.get("id") == user_id:
            return u
    return None


async def create_user(user_data: dict):
    existing = await get_user_by_email(user_data["email"])
    if existing:
        return existing

    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            doc_ref = db.collection(USERS_COLLECTION).document()
            user_data["created_at"] = datetime.utcnow()
            if "role" not in user_data:
                user_data["role"] = "free"
            doc_ref.set(user_data)
            return {**user_data, "id": doc_ref.id}
        except Exception:
            pass

    # Local fallback
    import uuid
    users = _load_local_users()
    user_data["id"] = str(uuid.uuid4())[:8]
    user_data["created_at"] = datetime.utcnow().isoformat()
    if "role" not in user_data:
        user_data["role"] = "free"
    users.append(user_data)
    _save_local_users(users)
    return user_data


async def update_user(user_id: str, updates: dict):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            doc_ref = db.collection(USERS_COLLECTION).document(user_id)
            doc_ref.update(updates)
            return {**doc_ref.get().to_dict(), "id": user_id}
        except Exception:
            pass

    # Local fallback
    users = _load_local_users()
    for u in users:
        if u.get("id") == user_id:
            u.update(updates)
            _save_local_users(users)
            return u
    return None



async def update_user_prediction_stats(user_id: str, new_slip_status: str, total_odds: float):
    User = await get_user_by_id(user_id)
    if not User:
        return
    
    stats = User.get("stats", {"won": 0, "lost": 0, "push": 0, "partial": 0, "total_roi": 0.0, "prediction_count": 0})
    stats["prediction_count"] += 1
    
    if new_slip_status == "WON":
        stats["won"] += 1
        stats["total_roi"] += (total_odds - 1) * 100
    elif new_slip_status == "LOST":
        stats["lost"] += 1
        stats["total_roi"] -= 100
    elif new_slip_status == "PUSH":
        stats["push"] += 1
    elif new_slip_status == "PARTIAL":
        stats["partial"] += 1
        
    total_decided = stats["won"] + stats["lost"] + stats["partial"]
    stats["hit_rate"] = round(stats["won"] / total_decided * 100, 2) if total_decided > 0 else 0.0
    
    await update_user(user_id, {"stats": stats})

# --- Payment Helpers ---
async def create_payment(payment_data: dict):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            from google.cloud import firestore
            db = get_firestore_db()
            doc_ref = db.collection(PAYMENTS_COLLECTION).document()
            payment_data["created_at"] = datetime.utcnow()
            payment_data["status"] = payment_data.get("status", "pending")
            doc_ref.set(payment_data)
            return {**payment_data, "id": doc_ref.id}
        except Exception:
            pass
    return payment_data


async def get_user_payments(user_id: str):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            from google.cloud import firestore
            db = get_firestore_db()
            docs = db.collection(PAYMENTS_COLLECTION).where("user_id", "==", user_id).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
            return [{**doc.to_dict(), "id": doc.id} for doc in docs]
        except Exception:
            pass
    return []


async def get_payment_by_portone_id(portone_payment_id: str):
    """포트원 paymentId로 결제 기록 조회 (중복 방지용)"""
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            docs = db.collection(PAYMENTS_COLLECTION).where(
                "portone_payment_id", "==", portone_payment_id
            ).limit(1).stream()
            for doc in docs:
                return {**doc.to_dict(), "id": doc.id}
        except Exception:
            pass
    return None


async def get_user_by_payment_id(portone_payment_id: str):
    """포트원 paymentId로 해당 결제를 한 유저 조회 (취소 처리용)"""
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            # payments 컬렉션에서 해당 결제 찾기
            docs = db.collection(PAYMENTS_COLLECTION).where(
                "portone_payment_id", "==", portone_payment_id
            ).limit(1).stream()
            for doc in docs:
                payment = doc.to_dict()
                user_id = payment.get("user_id")
                if user_id:
                    return await get_user_by_id(user_id)
        except Exception:
            pass
    return None


# --- Portfolio Helpers ---
async def add_portfolio_item(item_data: dict):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            db = get_firestore_db()
            doc_ref = db.collection(PORTFOLIO_COLLECTION).document()
            item_data["created_at"] = datetime.utcnow()
            doc_ref.set(item_data)
            return {**item_data, "id": doc_ref.id}
        except Exception:
            pass
    return item_data


async def get_user_portfolio(user_id: str):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            from google.cloud import firestore
            db = get_firestore_db()
            docs = db.collection(PORTFOLIO_COLLECTION).where("user_id", "==", user_id).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
            return [{**doc.to_dict(), "id": doc.id} for doc in docs]
        except Exception:
            pass
    return []


# --- Admin Helpers ---
async def get_all_users(limit: int = 100):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            from google.cloud import firestore
            db = get_firestore_db()
            docs = db.collection(USERS_COLLECTION).order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit).stream()
            return [{**doc.to_dict(), "id": doc.id} for doc in docs]
        except Exception:
            pass
    
    # Local fallback
    users = _load_local_users()
    # sort by created_at desc if possible
    try:
        users.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    except Exception:
        pass
    return users[:limit]


async def get_all_payments(limit: int = 100):
    if _is_firestore_available():
        try:
            from app.db.firestore import get_firestore_db
            from google.cloud import firestore
            db = get_firestore_db()
            docs = db.collection(PAYMENTS_COLLECTION).order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit).stream()
            return [{**doc.to_dict(), "id": doc.id} for doc in docs]
        except Exception:
            pass
    return []

