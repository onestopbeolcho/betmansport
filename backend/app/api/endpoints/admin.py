"""
관리자 API — 시스템 설정
🔐 모든 엔드포인트에 Admin 인증 Guard 적용
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
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
    result = await update_system_config(data)
    return {"success": True, "message": f"{len(data)}개 설정 저장됨 (즉시 적용)", "saved_fields": list(data.keys())}



# ─────────────────────────────────────────────
# 회원 관리 & 결제 내역 (Users & Payments)
# ─────────────────────────────────────────────

@router.get("/users")
async def get_users_list(limit: int = 100, admin_id: str = Depends(require_admin)):
    """가입된 전체 회원 목록 조회"""
    from app.models.user_db import get_all_users
    users = await get_all_users(limit=limit)
    return {
        "count": len(users),
        "users": users
    }


@router.get("/payments")
async def get_payments_list(limit: int = 100, admin_id: str = Depends(require_admin)):
    """전체 결제 내역 목록 조회"""
    from app.models.user_db import get_all_payments
    payments = await get_all_payments(limit=limit)
    return {
        "count": len(payments),
        "payments": payments
    }

