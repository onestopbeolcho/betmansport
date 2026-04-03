"""
PortOne + KG이니시스 결제 & 구독 관리 API

PortOne(포트원) V2 + KG이니시스 PG 방식:
- /verify           : PortOne 결제 검증 → DB 저장 + tier 업그레이드
- /my               : 내 구독 상태 + 결제 내역
- /cancel           : 구독 취소
- /plans            : 요금제 목록
- /webhook          : PortOne 웹훅 (선택)

🔑 .env 설정:
  PORTONE_STORE_ID     = store-xxxxxxxx
  PORTONE_API_SECRET   = xxxxxxxxxxxxxxxx
  PORTONE_CHANNEL_KEY  = channel-key-xxxxxxxx (KG이니시스)
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
            "LightGBM AI 분석 무제한 (전 리그)",
            "AI TOP PICK — 오늘의 최고 추천 경기",
            "신뢰도 게이지 + EV(기대수익) 분석",
            "조합 배팅 시뮬레이터 + 예상 수익 계산",
            "피나클 vs 벳맨 배당 차이 분석",
            "AI 전문 챗봇 무제한 이용",
            "고가치 배팅 실시간 알림",
            "포트폴리오 관리 + ROI 트래커",
        ],
    },
    "vip": {
        "name": "VIP Elite",
        "price": 105000,
        "currency": "krw",
        "tier": "premium",
        "features": [
            "Pro Investor 전체 기능 포함",
            "AI 심층 리포트 (경기당 상세 분석 PDF)",
            "급변 배당 즉시 알림 (이메일/푸시)",
            "AI 자동 조합 최적화 (최고수익 추천)",
            "프리미엄 경기 미리보기 (6시간 전)",
            "주간 AI 수익률 리포트 (자동 발송)",
            "우선적 고객 지원",
        ],
    },
}


# ─── Schemas ──────────────────────────────────────────────────
class VerifyRequest(BaseModel):
    payment_id: str   # 프론트에서 생성한 paymentId
    plan_id: str      # "pro" or "vip"
    billing: str = "monthly"  # "monthly" or "annual"


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

        # 결제 금액 검증 (monthly / annual 모두 지원)
        paid_amount = payment_data.get("amount", {}).get("total", 0)
        monthly_price = plan["price"]
        annual_price = round(monthly_price * 0.8) * 12  # 20% 할인 * 12개월
        valid_amounts = [monthly_price, annual_price]
        if paid_amount not in valid_amounts:
            logger.error(
                f"금액 불일치: 결제={paid_amount}, 허용={valid_amounts}"
            )
            raise HTTPException(400, "결제 금액이 일치하지 않습니다.")
        is_annual = (paid_amount == annual_price)

        # 유저 tier 업그레이드
        sub_days = 365 if is_annual else 30
        expires_at = (datetime.utcnow() + timedelta(days=sub_days)).isoformat()
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


# ─── PortOne 웹훅 (실연동) ────────────────────────────────────
PORTONE_WEBHOOK_SECRET = os.getenv("PORTONE_WEBHOOK_SECRET", "")


def _verify_webhook_signature(body_bytes: bytes, headers: dict) -> bool:
    """
    Standard Webhooks 스펙에 따른 HMAC-SHA256 시그니처 검증.
    포트원 웹훅 헤더:
      - webhook-id: 메시지 고유 ID
      - webhook-timestamp: 발송 시각 (Unix timestamp)
      - webhook-signature: 쉼표 구분된 서명 목록 (v1,xxxx 형식)
    """
    if not PORTONE_WEBHOOK_SECRET:
        logger.warning("⚠️ PORTONE_WEBHOOK_SECRET 미설정 — 시그니처 검증 건너뜀")
        return True  # 시크릿 미설정 시 검증 스킵 (개발 단계)

    import base64
    import hashlib
    import hmac
    import time

    msg_id = headers.get("webhook-id", "")
    timestamp = headers.get("webhook-timestamp", "")
    signature_header = headers.get("webhook-signature", "")

    if not msg_id or not timestamp or not signature_header:
        logger.error("❌ 웹훅 헤더 누락 (webhook-id/timestamp/signature)")
        return False

    # 타임스탬프 유효성 (5분 이내)
    try:
        ts = int(timestamp)
        if abs(time.time() - ts) > 300:
            logger.error(f"❌ 웹훅 타임스탬프 만료: {ts}")
            return False
    except ValueError:
        return False

    # 서명 검증
    # 포트원 시크릿은 "whsec_" 접두어 + base64 인코딩된 키
    secret = PORTONE_WEBHOOK_SECRET
    if secret.startswith("whsec_"):
        secret = secret[6:]

    try:
        secret_bytes = base64.b64decode(secret)
    except Exception:
        secret_bytes = secret.encode("utf-8")

    signed_content = f"{msg_id}.{timestamp}.".encode("utf-8") + body_bytes
    expected_sig = base64.b64encode(
        hmac.new(secret_bytes, signed_content, hashlib.sha256).digest()
    ).decode("utf-8")

    # signature_header는 "v1,xxxx" 형식 (쉼표 구분 가능)
    for sig_part in signature_header.split(" "):
        sig_parts = sig_part.split(",", 1)
        if len(sig_parts) == 2 and sig_parts[0] == "v1":
            if hmac.compare_digest(sig_parts[1], expected_sig):
                return True

    logger.error("❌ 웹훅 시그니처 불일치")
    return False


@router.post("/webhook")
async def portone_webhook(request: Request):
    """
    PortOne V2 웹훅 수신 (2024-04-25 버전 대응).

    주요 이벤트 처리:
    - Transaction.Paid    → 결제 누락 복구 (브라우저 이탈 등)
    - Transaction.Cancelled → 환불/취소 시 tier 다운그레이드
    - Transaction.Failed  → 실패 기록
    - 기타 이벤트         → 로깅 후 무시 (에러 발생시키지 않음)
    """
    body_bytes = await request.body()
    headers = dict(request.headers)

    # 1. 시그니처 검증
    if not _verify_webhook_signature(body_bytes, headers):
        logger.error("🚨 웹훅 시그니처 검증 실패 — 위조 요청 의심")
        return {"error": "Invalid signature"}, 400

    try:
        body = await request.json()
    except Exception:
        logger.error("❌ 웹훅 body JSON 파싱 실패")
        return {"received": True}

    event_type = body.get("type", "")
    data = body.get("data", {})
    payment_id = data.get("paymentId")
    timestamp = body.get("timestamp", "")

    logger.info(f"📨 PortOne 웹훅 수신: {event_type} | paymentId={payment_id} | ts={timestamp}")

    # ─── Transaction.Paid: 결제 완료 (누락 복구) ──────────────
    if event_type == "Transaction.Paid" and payment_id:
        try:
            # PortOne API로 실제 결제 상태 조회 (웹훅만 신뢰하지 않음)
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{PORTONE_API_BASE}/payments/{payment_id}",
                    headers={
                        "Authorization": f"PortOne {PORTONE_API_SECRET}",
                        "Content-Type": "application/json",
                    },
                )

            if response.status_code != 200:
                logger.error(f"결제 조회 실패: {response.status_code}")
                return {"received": True}

            payment_data = response.json()
            status = payment_data.get("status")

            if status != "PAID":
                logger.warning(f"결제 상태 불일치: 웹훅=Paid, API={status}")
                return {"received": True}

            paid_amount = payment_data.get("amount", {}).get("total", 0)

            # paymentId에서 planId 추출 (SPI_{planId}_{timestamp}_{random})
            plan_id = None
            if payment_id.startswith("SPI_"):
                parts = payment_id.split("_")
                if len(parts) >= 2:
                    plan_id = parts[1]  # "pro" or "vip"

            plan = PLANS.get(plan_id) if plan_id else None

            if not plan:
                logger.warning(f"플랜 식별 불가: paymentId={payment_id}")
                return {"received": True}

            # 금액 검증
            if paid_amount != plan["price"]:
                logger.error(f"⚠️ 금액 불일치 (웹훅): 결제={paid_amount}, 플랜={plan['price']}")
                return {"received": True}

            # 결제 기록 존재 여부 확인 (중복 방지)
            from app.models.user_db import get_payment_by_portone_id
            existing = None
            try:
                existing = await get_payment_by_portone_id(payment_id)
            except Exception:
                pass  # 함수 미존재 시 무시

            if existing:
                logger.info(f"✅ 이미 처리된 결제 (중복 웹훅 무시): {payment_id}")
                return {"received": True}

            # custom_data에서 user_id 추출 시도
            custom_data = payment_data.get("customData")
            customer = payment_data.get("customer", {})
            user_email = customer.get("email", "")

            # 이메일로 유저 찾기
            if user_email:
                from app.models.user_db import get_user_by_email
                try:
                    user = await get_user_by_email(user_email)
                    if user:
                        user_id = user.get("id") or user.get("uid")
                        expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()

                        await update_user(user_id, {
                            "tier": plan["tier"],
                            "subscription_plan": plan_id,
                            "subscription_expires_at": expires_at,
                            "subscription_cancel_requested": False,
                            "portone_payment_id": payment_id,
                        })

                        await create_payment({
                            "user_id": user_id,
                            "plan_id": plan_id,
                            "amount": paid_amount,
                            "currency": plan["currency"],
                            "portone_payment_id": payment_id,
                            "payment_method": payment_data.get("method", {}).get("type", "CARD"),
                            "status": "completed",
                            "source": "webhook",
                        })

                        logger.info(f"✅ 웹훅으로 결제 복구 완료: user={user_id}, plan={plan_id}")
                except Exception as e:
                    logger.error(f"웹훅 결제 복구 실패: {e}")

        except Exception as e:
            logger.error(f"Transaction.Paid 웹훅 처리 오류: {e}")

    # ─── Transaction.Cancelled: 결제 취소/환불 ────────────────
    elif event_type in ("Transaction.Cancelled", "Transaction.PartialCancelled") and payment_id:
        try:
            # 해당 결제건의 유저 찾아서 tier 다운그레이드
            from app.models.user_db import get_user_by_payment_id
            try:
                user = await get_user_by_payment_id(payment_id)
                if user:
                    user_id = user.get("id") or user.get("uid")
                    await update_user(user_id, {
                        "tier": "free",
                        "subscription_plan": None,
                        "subscription_expires_at": None,
                    })
                    logger.info(f"🔄 결제 취소 → tier 다운그레이드: user={user_id}")
            except Exception:
                pass  # 함수 미존재 시 무시

            logger.info(f"💸 결제 취소 웹훅 처리: {payment_id} ({event_type})")

        except Exception as e:
            logger.error(f"Transaction.Cancelled 웹훅 처리 오류: {e}")

    # ─── Transaction.Failed: 결제 실패 ───────────────────────
    elif event_type == "Transaction.Failed":
        logger.warning(f"❌ 결제 실패 웹훅: paymentId={payment_id}")

    # ─── 기타 이벤트: 로깅만 (에러 발생시키지 않음) ──────────
    else:
        logger.info(f"ℹ️ 미처리 웹훅 이벤트: {event_type}")

    return {"received": True}
