from datetime import datetime
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import require_current_user
from app.models.user_db import get_user_by_id, update_user
from app.db.firestore import get_firestore_db

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Schemas ---
class ChargeRequest(BaseModel):
    amount: int = Field(..., gt=0, description="충전할 골드 수량")
    payment_method: str = Field("TEST_PAY", description="결제 수단")

class PostCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    content: str = Field(..., min_length=10)
    price_gold: int = Field(0, ge=0, description="열람 가격 (0이면 무료)")

class PostResponse(BaseModel):
    id: str
    author_id: str
    author_name: str
    title: str
    content: str  # 잠겨있을 경우 마스킹 처리됨
    price_gold: int
    is_locked: bool
    purchased_users: List[str]
    created_at: datetime

class GiftRequest(BaseModel):
    tipster_id: str = Field(..., description="선물 대상 팁스터의 유저 ID")
    amount: int = Field(..., gt=0, description="선물할 골드 수량")

# --- Endpoints ---

@router.get("/balance")
async def get_gold_balance(user_id: str = Depends(require_current_user)):
    """현재 로그인 유저의 가상 골드 잔액 및 팁스터 크레딧 조회"""
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")
    
    return {
        "gold_balance": user.get("gold_balance", 0),
        "tipster_credits": user.get("tipster_credits", 0),
        "is_tipster": user.get("is_tipster", False),
        "display_name": user.get("display_name", user.get("email", "User")),
    }

@router.post("/charge")
async def charge_gold(
    req: ChargeRequest,
    user_id: str = Depends(require_current_user)
):
    """테스트 골드 충전 (실 운영시 Lemon Squeezy Webhook 등으로 전환 가능)"""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "데이터베이스 연결 불가")

    user_ref = db.collection("users").document(user_id)
    
    # 트랜잭션 처리
    from google.cloud import firestore
    @firestore.transactional
    def update_balance_in_transaction(transaction, user_ref, amount):
        snapshot = user_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")
        current_gold = snapshot.get("gold_balance") if "gold_balance" in snapshot.to_dict() else 0
        new_gold = current_gold + amount
        
        transaction.update(user_ref, {"gold_balance": new_gold})
        return new_gold

    transaction = db.transaction()
    try:
        new_gold = update_balance_in_transaction(transaction, user_ref, req.amount)
        
        # 거래 로그 생성
        tx_ref = db.collection("gold_transactions").document()
        tx_ref.set({
            "user_id": user_id,
            "amount": req.amount,
            "type": "charge",
            "payment_method": req.payment_method,
            "status": "completed",
            "created_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "message": f"{req.amount} 골드가 충전되었습니다.",
            "gold_balance": new_gold
        }
    except Exception as e:
        logger.error(f"Gold charge error: {e}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"충전 처리 중 에러 발생: {str(e)}")

@router.post("/posts")
async def create_tipster_post(
    req: PostCreateRequest,
    user_id: str = Depends(require_current_user)
):
    """팁스터 분석글 업로드"""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "데이터베이스 연결 불가")
    
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사용자를 찾을 수 없습니다.")
    
    # 팁스터 여부 확인 (테스트 목적으로 팁스터가 아니어도 등록 가능하게 하되, 디폴트는 True 처리하도록 함)
    # 팁스터 활성화가 안 되어 있다면 자동 활성화
    if not user.get("is_tipster"):
        await update_user(user_id, {"is_tipster": True})
        
    post_data = {
        "author_id": user_id,
        "author_name": user.get("display_name") or user.get("email", "Anonymous Tipster"),
        "title": req.title,
        "content": req.content,
        "price_gold": req.price_gold,
        "purchased_users": [],
        "created_at": datetime.utcnow()
    }
    
    doc_ref = db.collection("tipster_posts").document()
    doc_ref.set(post_data)
    
    return {
        "success": True,
        "post_id": doc_ref.id,
        "message": "분석글이 성공적으로 등록되었습니다."
    }

@router.get("/posts", response_model=List[PostResponse])
async def list_tipster_posts(
    user_id: Optional[str] = Depends(require_current_user)
):
    """전체 팁스터 분석글 목록 조회 (내용 잠금 여부 포함)"""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "데이터베이스 연결 불가")
        
    posts = []
    docs = db.collection("tipster_posts").order_by("created_at", direction="DESCENDING").limit(50).stream()
    
    for doc in docs:
        d = doc.to_dict()
        pid = doc.id
        author_id = d.get("author_id")
        price = d.get("price_gold", 0)
        purchased = d.get("purchased_users", [])
        
        is_locked = False
        content = d.get("content", "")
        
        # 잠금 판단 조건: 유료글이면서, 본인 글이 아니고, 구매 이력이 없는 경우
        if price > 0 and author_id != user_id and user_id not in purchased:
            is_locked = True
            content = "[🔒 이 정보는 골드로 잠겨 있습니다. 잠금을 해제하여 전체 분석을 확인하세요!]"
            
        posts.append(PostResponse(
            id=pid,
            author_id=author_id,
            author_name=d.get("author_name", "Anonymous"),
            title=d.get("title", ""),
            content=content,
            price_gold=price,
            is_locked=is_locked,
            purchased_users=purchased,
            created_at=d.get("created_at")
        ))
        
    return posts

@router.get("/posts/{post_id}", response_model=PostResponse)
async def get_tipster_post(
    post_id: str,
    user_id: str = Depends(require_current_user)
):
    """특정 분석글 상세 조회"""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "데이터베이스 연결 불가")
        
    doc_ref = db.collection("tipster_posts").document(post_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "분석글을 찾을 수 없습니다.")
        
    d = doc.to_dict()
    author_id = d.get("author_id")
    price = d.get("price_gold", 0)
    purchased = d.get("purchased_users", [])
    
    is_locked = False
    content = d.get("content", "")
    
    if price > 0 and author_id != user_id and user_id not in purchased:
        is_locked = True
        content = "[🔒 이 정보는 골드로 잠겨 있습니다. 잠금을 해제하여 전체 분석을 확인하세요!]"
        
    return PostResponse(
        id=post_id,
        author_id=author_id,
        author_name=d.get("author_name", "Anonymous"),
        title=d.get("title", ""),
        content=content,
        price_gold=price,
        is_locked=is_locked,
        purchased_users=purchased,
        created_at=d.get("created_at")
    )

@router.post("/posts/{post_id}/unlock")
async def unlock_tipster_post(
    post_id: str,
    user_id: str = Depends(require_current_user)
):
    """골드를 사용하여 팁스터 유료글 잠금 해제"""
    db = get_firestore_db()
    if not db:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "데이터베이스 연결 불가")
        
    post_ref = db.collection("tipster_posts").document(post_id)
    post = post_ref.get()
    if not post.exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "분석글을 찾을 수 없습니다.")
        
    d = post.to_dict()
    price = d.get("price_gold", 0)
    author_id = d.get("author_id")
    purchased = d.get("purchased_users", [])
    
    if price <= 0:
        return {"success": True, "message": "이미 공개된 무료 글입니다."}
        
    if author_id == user_id:
        return {"success": True, "message": "본인 글은 골드가 소모되지 않습니다."}
        
    if user_id in purchased:
        return {"success": True, "message": "이미 구매 완료된 글입니다."}
        
    user_ref = db.collection("users").document(user_id)
    author_ref = db.collection("users").document(author_id)
    
    # 수수료율 설정: 30% 수수료 차감 후 70%를 크레딧으로 팁스터에게 적립
    commission_rate = 0.30
    tipster_earning = int(price * (1 - commission_rate))
    
    from google.cloud import firestore
    @firestore.transactional
    def execute_unlock(transaction, user_ref, author_ref, post_ref, price, tipster_earning, user_id):
        # 1. 구매자 잔액 조회 및 검증
        user_snap = user_ref.get(transaction=transaction)
        if not user_snap.exists:
            raise HTTPException(404, "구매 사용자를 찾을 수 없습니다.")
        user_gold = user_snap.get("gold_balance") if "gold_balance" in user_snap.to_dict() else 0
        if user_gold < price:
            raise HTTPException(400, "골드 잔액이 부족합니다.")
            
        # 2. 팁스터 조회
        author_snap = author_ref.get(transaction=transaction)
        if not author_snap.exists:
            raise HTTPException(404, "분석가 정보를 찾을 수 없습니다.")
        author_credits = author_snap.get("tipster_credits") if "tipster_credits" in author_snap.to_dict() else 0
        
        # 3. 데이터 업데이트
        transaction.update(user_ref, {"gold_balance": user_gold - price})
        transaction.update(author_ref, {"tipster_credits": author_credits + tipster_earning})
        transaction.update(post_ref, {"purchased_users": firestore.ArrayUnion([user_id])})
        
        return user_gold - price

    transaction = db.transaction()
    try:
        new_balance = execute_unlock(transaction, user_ref, author_ref, post_ref, price, tipster_earning, user_id)
        
        # 거래 내역 추가
        tx_ref = db.collection("gold_transactions").document()
        tx_ref.set({
            "user_id": user_id,
            "target_id": author_id,
            "amount": -price,
            "type": "purchase_tip",
            "ref_id": post_id,
            "status": "completed",
            "created_at": datetime.utcnow()
        })
        
        # 팁스터 수익 로그
        tx_ref_tipster = db.collection("gold_transactions").document()
        tx_ref_tipster.set({
            "user_id": author_id,
            "source_id": user_id,
            "amount": tipster_earning,
            "type": "tip_income",
            "ref_id": post_id,
            "status": "completed",
            "created_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "message": "잠금 해제되었습니다.",
            "gold_balance": new_balance
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unlock post transaction error: {e}")
        raise HTTPException(500, f"잠금 해제 처리 중 에러 발생: {str(e)}")

@router.post("/gift")
async def gift_tipster(
    req: GiftRequest,
    user_id: str = Depends(require_current_user)
):
    """팁스터에게 직접 골드 후원(선물)하기"""
    if req.tipster_id == user_id:
        raise HTTPException(400, "본인에게는 후원할 수 없습니다.")
        
    db = get_firestore_db()
    if not db:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "데이터베이스 연결 불가")
        
    user_ref = db.collection("users").document(user_id)
    tipster_ref = db.collection("users").document(req.tipster_id)
    
    # 30% 수수료 적용
    commission_rate = 0.30
    tipster_earning = int(req.amount * (1 - commission_rate))
    
    from google.cloud import firestore
    @firestore.transactional
    def execute_gift(transaction, user_ref, tipster_ref, amount, tipster_earning):
        user_snap = user_ref.get(transaction=transaction)
        if not user_snap.exists:
            raise HTTPException(404, "후원 사용자를 찾을 수 없습니다.")
        user_gold = user_snap.get("gold_balance") if "gold_balance" in user_snap.to_dict() else 0
        if user_gold < amount:
            raise HTTPException(400, "골드 잔액이 부족합니다.")
            
        tipster_snap = tipster_ref.get(transaction=transaction)
        if not tipster_snap.exists:
            raise HTTPException(404, "후원 대상 팁스터를 찾을 수 없습니다.")
        tipster_credits = tipster_snap.get("tipster_credits") if "tipster_credits" in tipster_snap.to_dict() else 0
        
        transaction.update(user_ref, {"gold_balance": user_gold - amount})
        transaction.update(tipster_ref, {"tipster_credits": tipster_credits + tipster_earning})
        
        return user_gold - amount

    transaction = db.transaction()
    try:
        new_balance = execute_gift(transaction, user_ref, tipster_ref, req.amount, tipster_earning)
        
        # 거래 로그
        tx_ref_user = db.collection("gold_transactions").document()
        tx_ref_user.set({
            "user_id": user_id,
            "target_id": req.tipster_id,
            "amount": -req.amount,
            "type": "gift_send",
            "status": "completed",
            "created_at": datetime.utcnow()
        })
        
        tx_ref_tipster = db.collection("gold_transactions").document()
        tx_ref_tipster.set({
            "user_id": req.tipster_id,
            "source_id": user_id,
            "amount": tipster_earning,
            "type": "gift_receive",
            "status": "completed",
            "created_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "message": "후원이 성공적으로 완료되었습니다.",
            "gold_balance": new_balance
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gift transaction error: {e}")
        raise HTTPException(500, f"후원 처리 중 에러 발생: {str(e)}")
