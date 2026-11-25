"""
관리자 API — 시스템 설정, 회원/결제 통계 대시보드, 가상 결제 시뮬레이터
🔐 모든 엔드포인트에 Admin 인증 Guard 적용
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import asyncio
import logging

from app.core.deps import require_admin

router = APIRouter()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# System Config (기존)
# ─────────────────────────────────────────────

class SystemConfigSchema(BaseModel):
    api_football_key: Optional[str] = ""
    gemini_api_key: Optional[str] = ""
    buffer_access_token: Optional[str] = ""
    football_data_api_key: Optional[str] = ""
    api_basketball_key: Optional[str] = ""
    live_score_api_key: Optional[str] = ""
    live_score_api_secret: Optional[str] = ""
    the_odds_api_key: Optional[str] = ""
    secret_key: Optional[str] = ""
    lemon_squeezy_api_key: Optional[str] = ""
    betman_user_agent: Optional[str] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    scrape_interval_minutes: Optional[int] = 60


@router.get("/config")
async def get_config(admin_id: str = Depends(require_admin)):
    """Firestore에서 현재 설정 조회 (키 값은 마스킹)"""
    from app.models.config_db import get_system_config
    data = await get_system_config()

    # 보안: API 키 마스킹
    masked = {}
    for k, v in data.items():
        if "key" in k.lower() or "secret" in k.lower() or "token" in k.lower():
            if v and len(str(v)) > 8:
                masked[k] = str(v)[:4] + "****" + str(v)[-4:]
            elif v:
                masked[k] = "****"
            else:
                masked[k] = ""
        else:
            masked[k] = v
    return masked


@router.post("/config")
async def save_config(new_config: SystemConfigSchema, admin_id: str = Depends(require_admin)):
    """API 키를 Firestore에 영구 저장 + 즉시 환경변수에 반영"""
    from app.models.config_db import update_system_config

    data = new_config.dict(exclude_none=True)
    # 빈 문자열 필드 제거 (기존 값 보존)
    data = {k: v for k, v in data.items() if v != "" and v is not None}
    await update_system_config(data)
    return {"success": True, "message": f"{len(data)}개 설정 저장됨 (즉시 적용)", "saved_fields": list(data.keys())}


# ─────────────────────────────────────────────
# 통합 어드민 대시보드 요약 & 회원/결제 관리
# ─────────────────────────────────────────────

@router.get("/overview")
async def get_admin_overview(limit: int = 200, admin_id: str = Depends(require_admin)):
    """모바일/PC 통합 어드민 원스톱 요약 (가입자 수, 유료 구독자 수, 결제 매출, 회원/결제 리스트)"""
    from app.models.user_db import get_all_users, get_all_payments

    users = await get_all_users(limit=limit)
    payments = await get_all_payments(limit=limit)

    safe_users = []
    user_map = {}
    paid_users_count = 0
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    today_signups = 0

    for u in users:
        u_copy = {k: v for k, v in u.items() if k not in ("password_hash", "hashed_password")}
        if hasattr(u_copy.get("created_at"), "isoformat"):
            u_copy["created_at"] = u_copy["created_at"].isoformat()
        created_str = str(u_copy.get("created_at", ""))
        if created_str.startswith(today_str):
            today_signups += 1

        tier = str(u_copy.get("tier") or u_copy.get("role") or "free").lower()
        if tier in ("pro", "premium", "vip"):
            paid_users_count += 1

        safe_users.append(u_copy)
        user_map[u_copy.get("id")] = u_copy

    # 중복 웹훅 결제 레코드 제외한 실매출 및 전체 결제 목록 정리
    seen_portone_ids = set()
    total_revenue_krw = 0
    unique_paid_count = 0
    enriched_payments = []

    for p in payments:
        p_copy = dict(p)
        if hasattr(p_copy.get("created_at"), "isoformat"):
            p_copy["created_at"] = p_copy["created_at"].isoformat()
        uid = p_copy.get("user_id")
        u_info = user_map.get(uid, {})
        p_copy["user_email"] = u_info.get("email") or p_copy.get("user_email") or "-"
        p_copy["user_nickname"] = u_info.get("nickname") or u_info.get("full_name") or "-"
        p_copy["user_phone"] = u_info.get("phone") or "-"

        portone_id = p_copy.get("portone_payment_id") or p_copy.get("id")
        status = str(p_copy.get("status", "")).lower()
        amount = int(p_copy.get("amount") or 0)

        if status in ("completed", "paid"):
            if portone_id not in seen_portone_ids:
                seen_portone_ids.add(portone_id)
                total_revenue_krw += amount
                unique_paid_count += 1
                p_copy["is_duplicate_log"] = False
            else:
                p_copy["is_duplicate_log"] = True

        enriched_payments.append(p_copy)

    return {
        "summary": {
            "total_users": len(safe_users),
            "today_signups": today_signups,
            "paid_subscribers": paid_users_count,
            "unique_payments_count": unique_paid_count,
            "total_revenue_krw": total_revenue_krw,
        },
        "users": safe_users,
        "payments": enriched_payments,
    }


@router.get("/users")
async def get_users_list(limit: int = 200, admin_id: str = Depends(require_admin)):
    """가입된 전체 회원 목록 조회"""
    from app.models.user_db import get_all_users
    users = await get_all_users(limit=limit)
    safe_users = []
    for u in users:
        u_copy = {k: v for k, v in u.items() if k not in ("password_hash", "hashed_password")}
        if hasattr(u_copy.get("created_at"), "isoformat"):
            u_copy["created_at"] = u_copy["created_at"].isoformat()
        safe_users.append(u_copy)
    return {
        "count": len(safe_users),
        "users": safe_users
    }


class UpdateUserTierSchema(BaseModel):
    tier: str  # "free", "pro", "premium", "admin"
    days: Optional[int] = 30


@router.post("/users/{user_id}/tier")
async def update_user_tier(user_id: str, body: UpdateUserTierSchema, admin_id: str = Depends(require_admin)):
    """관리자 수동 회원 등급(tier/role) 변경"""
    from app.models.user_db import get_user_by_id, update_user
    from app.core.deps import is_admin_user

    tier = body.tier.lower().strip()
    if tier not in ("free", "pro", "premium", "admin"):
        raise HTTPException(status_code=400, detail="유효하지 않은 등급입니다.")

    target_user = await get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    # 관리자의 경우 tier를 변경하더라도 role='admin'은 유지하여 관리자 권한이 풀리지 않도록 보호
    keep_admin_role = is_admin_user(target_user) or (tier == "admin")
    updates = {
        "tier": tier,
        "role": "admin" if keep_admin_role else tier,
    }
    if tier in ("pro", "premium"):
        updates["subscription_plan"] = "vip" if tier == "premium" else "pro"
        updates["subscription_expires_at"] = (datetime.utcnow() + timedelta(days=body.days or 30)).isoformat()
    elif tier == "free":
        updates["subscription_plan"] = None
        updates["subscription_expires_at"] = None

    updated = await update_user(user_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")
    return {"success": True, "user_id": user_id, "tier": tier, "role": updates["role"]}


@router.get("/payments")
async def get_payments_list(limit: int = 200, admin_id: str = Depends(require_admin)):
    """전체 결제 내역 목록 조회"""
    from app.models.user_db import get_all_payments
    payments = await get_all_payments(limit=limit)
    safe_payments = []
    for p in payments:
        p_copy = dict(p)
        if hasattr(p_copy.get("created_at"), "isoformat"):
            p_copy["created_at"] = p_copy["created_at"].isoformat()
        safe_payments.append(p_copy)
    return {
        "count": len(safe_payments),
        "payments": safe_payments
    }


class SimulatePaymentSchema(BaseModel):
    user_id: Optional[str] = None
    plan_id: str = "round_pass"  # "round_pass" (3900), "pro" (29900), "vip" (39000)


@router.post("/simulate-payment")
async def simulate_virtual_payment(body: SimulatePaymentSchema, admin_id: str = Depends(require_admin)):
    """
    [가상 결제 테스트] 실제 카드 승인 없이 결제 DB 적재 + 회원 등급(tier) 즉시 승격 + 만료일 세팅이
    정상 작동하는지 원클릭으로 검증하는 엔드포인트.
    """
    from app.models.user_db import get_user_by_id, update_user, create_payment
    from app.api.endpoints.payments import PLANS
    import uuid

    target_uid = body.user_id or admin_id
    target_user = await get_user_by_id(target_uid)
    if not target_user:
        raise HTTPException(status_code=404, detail="대상 회원을 찾을 수 없습니다.")

    plan = PLANS.get(body.plan_id, PLANS["round_pass"])
    sim_payment_id = f"SIM_{body.plan_id}_{int(datetime.utcnow().timestamp())}_{uuid.uuid4().hex[:6]}"
    sub_days = plan.get("duration_days", 5)
    expires_at = (datetime.utcnow() + timedelta(days=sub_days)).isoformat()

    await update_user(target_uid, {
        "tier": plan["tier"],
        "subscription_plan": body.plan_id,
        "subscription_expires_at": expires_at,
        "subscription_cancel_requested": False,
        "portone_payment_id": sim_payment_id,
    })

    payment_record = await create_payment({
        "user_id": target_uid,
        "plan_id": body.plan_id,
        "amount": plan["price"],
        "currency": plan["currency"],
        "portone_payment_id": sim_payment_id,
        "payment_method": "VIRTUAL_TEST (가상결제검증)",
        "status": "completed",
        "source": "admin_simulation",
    })

    if hasattr(payment_record.get("created_at"), "isoformat"):
        payment_record["created_at"] = payment_record["created_at"].isoformat()

    return {
        "success": True,
        "message": f"가상 결제 검증 완료! [{target_user.get('email')}] 계정이 [{plan['tier'].upper()}] 등급으로 승격되었습니다.",
        "payment": payment_record,
        "upgraded_tier": plan["tier"],
        "expires_at": expires_at,
    }


@router.delete("/payments/{payment_id}")
async def delete_test_payment(payment_id: str, admin_id: str = Depends(require_admin)):
    """테스트/가상 결제 기록 삭제"""
    from app.db.firestore import get_firestore_db
    db = get_firestore_db()
    db.collection("payments").document(payment_id).delete()
    return {"success": True, "deleted_id": payment_id}


# ─────────────────────────────────────────────
# 비디오 마케팅 설정 (Video Config)
# ─────────────────────────────────────────────

class VideoConfigSchema(BaseModel):
    tts_voice_ko: Optional[str] = "ko-KR-SunHiNeural"
    tts_voice_en: Optional[str] = "en-US-EmmaNeural"
    tts_voice_ja: Optional[str] = "ja-JP-NanamiNeural"
    tts_speed_ko: Optional[str] = "+15%"
    tts_speed_en: Optional[str] = "+12%"
    tts_speed_ja: Optional[str] = "+10%"
    tts_pitch_ko: Optional[str] = "+5Hz"
    tts_pitch_en: Optional[str] = "+0Hz"
    tts_pitch_ja: Optional[str] = "+0Hz"
    subtitle_base_size_intro: Optional[int] = 68
    subtitle_base_size_match: Optional[int] = 54
    subtitle_font_ko: Optional[str] = "malgun.ttf"
    subtitle_font_bold_ko: Optional[str] = "malgunbd.ttf"
    winning_intros: Optional[List[str]] = None
    winning_intro_caps: Optional[List[str]] = None
    winning_ctas: Optional[List[str]] = None
    winning_cta_caps: Optional[List[str]] = None
    educational_intros: Optional[List[str]] = None
    educational_intro_caps: Optional[List[str]] = None
    educational_ctas: Optional[List[str]] = None
    educational_cta_caps: Optional[List[str]] = None


@router.get("/video-config")
async def get_video_configuration(admin_id: str = Depends(require_admin)):
    """Firestore에서 현재 비디오 제작 설정 조회"""
    from app.models.config_db import get_video_config
    return await get_video_config()


@router.post("/video-config")
async def save_video_configuration(new_config: VideoConfigSchema, admin_id: str = Depends(require_admin)):
    """비디오 제작 설정을 Firestore에 저장 (즉시 적용)"""
    from app.models.config_db import update_video_config
    data = new_config.dict(exclude_none=True)
    await update_video_config(data)
    return {"success": True, "message": "비디오 제작 설정이 성공적으로 저장되었습니다 (즉시 적용)."}
