"""
Push 알림 API 엔드포인트
- Admin: 전체/개별 알림 발송
- System: 밸류벳 발견 시 자동 발송 (내부 호출)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.deps import require_current_user, require_admin
from app.services.notification_service import notification_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Request Schemas ───

class SendNotificationRequest(BaseModel):
    """알림 발송 요청"""
    notification_type: str  # value_bet, daily_pick, odds_change, result, marketing
    body: str
    url: Optional[str] = "/"
    user_id: Optional[str] = None  # 특정 사용자 (없으면 전체)
    lang: Optional[str] = "ko"


class ValueBetAlertRequest(BaseModel):
    """밸류벳 알림 요청"""
    match_name: str
    efficiency: float
    bet_type: str
    url: Optional[str] = "/bets/view"


class TestNotificationRequest(BaseModel):
    """테스트 알림 요청"""
    title: Optional[str] = "🔔 Scorenix 테스트"
    body: Optional[str] = "Push 알림이 정상 작동합니다!"


# ─── Admin Endpoints ───

@router.post("/send")
async def send_notification(req: SendNotificationRequest, admin=Depends(require_admin)):
    """
    [Admin] Push 알림 발송
    - user_id 지정 시: 해당 사용자에게만
    - user_id 없으면: 모든 활성 사용자에게
    """
    data = {"url": req.url or "/"}

    if req.user_id:
        success = await notification_service.send_to_user(
            user_id=req.user_id,
            notification_type=req.notification_type,
            body=req.body,
            data=data,
            lang=req.lang or "ko",
        )
        return {"success": success, "target": "individual", "user_id": req.user_id}
    else:
        result = await notification_service.send_to_all(
            notification_type=req.notification_type,
            body=req.body,
            data=data,
            lang=req.lang or "ko",
        )
        return {"success": True, "target": "broadcast", **result}


@router.post("/value-bet-alert")
async def send_value_bet_alert(req: ValueBetAlertRequest, admin=Depends(require_admin)):
    """[Admin] 밸류벳 발견 알림 발송"""
    result = await notification_service.send_value_bet_alert(
        match_name=req.match_name,
        efficiency=req.efficiency,
        bet_type=req.bet_type,
        url=req.url or "/bets/view",
    )
    return {"success": True, **result}


@router.post("/daily-pick")
async def send_daily_pick_alert(pick_count: int = 3, admin=Depends(require_admin)):
    """[Admin] 오늘의 추천 Pick 알림 발송"""
    result = await notification_service.send_daily_pick_alert(pick_count)
    return {"success": True, **result}


# ─── User Endpoints ───

@router.post("/test")
async def send_test_notification(req: TestNotificationRequest, user_id: str = Depends(require_current_user)):
    """[User] 테스트 알림 전송 (자신에게)"""
    success = await notification_service.send_to_user(
        user_id=user_id,
        notification_type="marketing",
        body=req.body or "Push 알림이 정상 작동합니다!",
        data={"url": "/"},
    )
    return {"success": success}


@router.get("/status")
async def get_notification_status(user_id: str = Depends(require_current_user)):
    """[User] 알림 상태 확인"""
    tokens = await notification_service.get_user_tokens(user_id)
    has_token = len(tokens) > 0

    # 알림 설정 조회
    from app.db.firestore import get_firestore_db
    prefs = {}
    try:
        db = get_firestore_db()
        doc = db.collection("notification_prefs").document(user_id).get()
        if doc.exists:
            prefs = doc.to_dict()
    except Exception:
        pass

    return {
        "enabled": has_token,
        "token_count": len(tokens),
        "preferences": {
            "valueBetAlert": prefs.get("valueBetAlert", True),
            "dailyPick": prefs.get("dailyPick", True),
            "oddsChange": prefs.get("oddsChange", False),
            "resultAlert": prefs.get("resultAlert", True),
            "marketingAlert": prefs.get("marketingAlert", False),
        }
    }


# ─── Internal System Endpoint (API key auth) ───

@router.post("/system/value-bet-discovered")
async def system_value_bet_discovered(req: ValueBetAlertRequest):
    """
    [System] 밸류벳 발견 시 자동 호출
    odds.py의 분석 로직에서 EV가 높은 경기 발견 시 내부적으로 호출
    """
    result = await notification_service.send_value_bet_alert(
        match_name=req.match_name,
        efficiency=req.efficiency,
        bet_type=req.bet_type,
        url=req.url or "/bets/view",
    )
    logger.info(f"🔔 밸류벳 알림 발송: {req.match_name} (효율 {req.efficiency}%) → {result}")
    return {"success": True, **result}
