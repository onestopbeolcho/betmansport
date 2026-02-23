"""
Tier 강제 적용 미들웨어 (Backend)

프론트엔드 PremiumGate 외에 백엔드에서도 Tier 체크.
무료 유저가 직접 API 호출로 프리미엄 기능 접근하는 것을 차단.
"""
from fastapi import Depends, HTTPException, status
from app.core.deps import require_current_user
from app.models.user_db import get_user_by_id
from datetime import datetime

TIER_ORDER = {"free": 0, "basic": 1, "pro": 2, "premium": 3}


async def _get_user_tier(user_id: str) -> str:
    """유저의 현재 Tier 확인 (구독 만료도 체크)"""
    user = await get_user_by_id(user_id)
    if not user:
        return "free"

    tier = user.get("tier", "free")
    expires_at = user.get("subscription_expires_at")

    # 구독 만료 체크
    if expires_at and tier != "free":
        try:
            exp_dt = datetime.fromisoformat(expires_at)
            if datetime.utcnow() > exp_dt:
                # 구독 만료 → 자동 다운그레이드
                from app.models.user_db import update_user
                await update_user(user_id, {
                    "tier": "free",
                    "subscription_plan": None,
                    "subscription_expires_at": None,
                })
                return "free"
        except (ValueError, TypeError):
            pass

    return tier


def require_tier(minimum_tier: str = "pro"):
    """
    Tier 강제 적용 의존성 팩토리.
    
    Usage:
        @router.get("/premium-feature")
        async def feature(user_id: str = Depends(require_tier("pro"))):
            ...
    """
    async def _check_tier(user_id: str = Depends(require_current_user)) -> str:
        user_tier = await _get_user_tier(user_id)
        required_level = TIER_ORDER.get(minimum_tier, 1)
        user_level = TIER_ORDER.get(user_tier, 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": f"이 기능은 {minimum_tier.upper()} 이상 멤버십이 필요합니다.",
                    "current_tier": user_tier,
                    "required_tier": minimum_tier,
                    "upgrade_url": "/pricing",
                },
            )
        return user_id

    return _check_tier
