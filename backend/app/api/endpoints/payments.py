"""
PortOne 결제 & 구독 관리 API

PortOne(포트원) V2 API 방식:
- /verify           : PortOne 결제 검증 → DB 저장 + tier 업그레이드
- /my               : 내 구독 상태 + 결제 내역
- /cancel           : 구독 취소
- /plans            : 요금제 목록
- /webhook          : PortOne 웹훅 (선택)

🔑 .env 설정:
  PORTONE_STORE_ID     = store-xxxxxxxx
  PORTONE_API_SECRET   = xxxxxxxxxxxxxxxx
  PORTONE_CHANNEL_KEY  = channel-key-xxxxxxxx
"""
import os
import logging
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.models.user_db import (
    create_payment, get_user_payments, get_user_by_id, update_user
)
from app.core.deps import require_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── PortOne 설정 ─────────────────────────────────────────────
PORTONE_API_SECRET = os.getenv("PORTONE_API_SECRET", "")
PORTONE_STORE_ID = os.getenv("PORTONE_STORE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# PortOne V2 API Base URL
PORTONE_API_BASE = "https://api.portone.io"

# ─── 요금제 정의 ─────────────────────────────────────────────
PLANS = {
    "pro": {
        "name": "Pro Investor",
        "price": 55000,
        "currency": "krw",
        "tier": "pro",
        "features": [
            "무제한 AI 분석 리포트",
            "실시간 알림 서비스",
            "고급 포트폴리오 관리",
            "단일 경기 심층 분석",
        ],
    },
    "vip": {
        "name": "VIP",
        "price": 105000,
        "currency": "krw",
        "tier": "premium",
        "features": [
            "Pro 플랜의 모든 기능",
            "전용 텔레그램 채널",
            "우선적 고객 지원",
            "1:1 프리미엄 리포트",
        ],
    },
}


# ─── Schemas ──────────────────────────────────────────────────
class VerifyRequest(BaseModel):
    payment_id: str   # 프론트에서 생성한 paymentId
    plan_id: str      # "pro" or "vip"


class CancelRequest(BaseModel):
    reason: str = "사용자 요청"


# ─── 요금제 목록 ──────────────────────────────────────────────
@router.get("/plans")
async def get_plans():
    """사용 가능한 요금제 목록"""
    return {
        "plans": PLANS,
        "store_id": PORTONE_STORE_ID,
    }


# ─── PortOne 결제 검증 ────────────────────────────────────────
@router.post("/verify")
async def verify_payment(
    req: VerifyRequest,
    user_id: str = Depends(require_current_user),
):
    """
    프론트에서 PortOne 결제 완료 후 호출.
    PortOne API로 결제 내역을 조회하여 검증 후 DB에 저장.

    Flow:
    1. 프론트: PortOne.requestPayment() → 결제 완료
    2. 프론트: POST /api/payments/verify { payment_id, plan_id }
    3. 백엔드: PortOne API로 결제 내역 조회 → 금액 검증
    4. 백엔드: 유저 tier 업그레이드 + 결제 기록 저장
    """
    plan = PLANS.get(req.plan_id)
    if not plan:
        raise HTTPException(400, f"유효하지 않은 요금제: {req.plan_id}")

    try:
        # PortOne V2 API로 결제 내역 조회
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PORTONE_API_BASE}/payments/{req.payment_id}",
                headers={
                    "Authorization": f"PortOne {PORTONE_API_SECRET}",
                    "Content-Type": "application/json",
                },
            )

        if response.status_code != 200:
            logger.error(f"PortOne API error: {response.status_code} {response.text}")
            raise HTTPException(400, "결제 정보를 조회할 수 없습니다.")

        payment_data = response.json()

        # 결제 상태 확인
        status = payment_data.get("status")
        if status != "PAID":
            raise HTTPException(400, f"결제가 완료되지 않았습니다. (상태: {status})")

        # 결제 금액 검증
        paid_amount = payment_data.get("amount", {}).get("total", 0)
        if paid_amount != plan["price"]:
            logger.error(
                f"금액 불일치: 결제={paid_amount}, 플랜={plan['price']}"
            )
            raise HTTPException(400, "결제 금액이 일치하지 않습니다.")

        # 유저 tier 업그레이드
        expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
        await update_user(user_id, {
            "tier": plan["tier"],
            "subscription_plan": req.plan_id,
            "subscription_expires_at": expires_at,
            "subscription_cancel_requested": False,
            "portone_payment_id": req.payment_id,
        })

        # 결제 기록 저장
        await create_payment({
            "user_id": user_id,
            "plan_id": req.plan_id,
            "amount": paid_amount,
            "currency": plan["currency"],
            "portone_payment_id": req.payment_id,
            "payment_method": payment_data.get("method", {}).get("type", "CARD"),
            "status": "completed",
        })

        logger.info(f"✅ 결제 검증 완료: user={user_id}, plan={req.plan_id}, amount={paid_amount}")

        return {
            "success": True,
            "message": "결제가 완료되었습니다.",
            "plan": plan["name"],
            "expires_at": expires_at,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment verification error: {e}")
        raise HTTPException(500, f"결제 검증 실패: {str(e)}")


# ─── 구독 취소 ────────────────────────────────────────────────
@router.post("/cancel")
async def cancel_subscription(
    req: CancelRequest,
    user_id: str = Depends(require_current_user),
):
    """구독 취소 (현재 기간 만료까지 유지)"""
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    tier = user.get("tier", "free")
    if tier == "free":
        raise HTTPException(400, "활성 구독이 없습니다")

    await update_user(user_id, {
        "subscription_cancel_requested": True,
        "subscription_cancel_reason": req.reason,
    })

    logger.info(f"🔄 구독 취소 요청: user={user_id}")
    return {
        "success": True,
        "message": "구독이 취소되었습니다. 현재 기간 만료까지 계속 이용 가능합니다.",
    }


# ─── 내 구독 상태 ─────────────────────────────────────────────
@router.get("/my")
async def get_my_subscription(user_id: str = Depends(require_current_user)):
    """현재 구독 상태 + 결제 내역"""
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "사용자를 찾을 수 없습니다")

    payments = await get_user_payments(user_id)

    return {
        "subscription": {
            "tier": user.get("tier", "free"),
            "plan": user.get("subscription_plan"),
            "expires_at": user.get("subscription_expires_at"),
            "cancel_requested": user.get("subscription_cancel_requested", False),
        },
        "payments": payments[:10],
    }


# ─── PortOne 웹훅 (선택) ─────────────────────────────────────
@router.post("/webhook")
async def portone_webhook(request: Request):
    """
    PortOne 웹훅 수신 (선택적 사용).
    주로 /verify 엔드포인트에서 검증하므로 웹훅은 보조적 용도.
    - 결제 취소/환불 알림
    - 정기결제 갱신 알림
    """
    body = await request.json()
    event_type = body.get("type", "")
    logger.info(f"📨 PortOne webhook: {event_type}")

    if event_type == "Transaction.Paid":
        payment_id = body.get("data", {}).get("paymentId")
        logger.info(f"결제 완료 웹훅: {payment_id}")

    elif event_type == "Transaction.Cancelled":
        payment_id = body.get("data", {}).get("paymentId")
        logger.info(f"결제 취소 웹훅: {payment_id}")

    return {"received": True}
