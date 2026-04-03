"""
VIP 커스텀 알림 규칙 API

VIP 사용자가 자신만의 알림 조건을 설정:
- 밸류 갭 N% 이상 시 알림
- 특정 리그/팀 경기 발견 시 알림
- 배당 변동 N% 이상 시 알림
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging
import uuid

from app.core.tier_guard import require_tier

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Schemas ───

class AlertRule(BaseModel):
    """커스텀 알림 규칙"""
    rule_type: str       # value_gap, odds_change, league, team
    field: str           # efficiency, odds, league_name, team_name
    operator: str        # >, <, >=, <=, ==, contains
    value: str           # 비교값 (문자열로 통일, 숫자/문자열 모두 지원)
    label: Optional[str] = ""   # 사용자 표시 라벨
    enabled: bool = True


class AlertRuleResponse(AlertRule):
    id: str
    created_at: str
    triggered_count: int = 0
    last_triggered: Optional[str] = None


class CreateRulesRequest(BaseModel):
    rules: List[AlertRule]


class UpdateRuleRequest(BaseModel):
    enabled: Optional[bool] = None
    label: Optional[str] = None
    value: Optional[str] = None


# ─── Preset Templates ───

PRESET_TEMPLATES = [
    {
        "id": "value_gap_15",
        "label": "밸류 갭 15% 이상",
        "rule_type": "value_gap",
        "field": "efficiency",
        "operator": ">=",
        "value": "15",
        "description": "배당 효율 차이가 15% 이상인 경기 발견 시 알림",
    },
    {
        "id": "value_gap_10",
        "label": "밸류 갭 10% 이상",
        "rule_type": "value_gap",
        "field": "efficiency",
        "operator": ">=",
        "value": "10",
        "description": "배당 효율 차이가 10% 이상인 경기 발견 시 알림",
    },
    {
        "id": "high_kelly",
        "label": "Kelly 5% 이상",
        "rule_type": "value_gap",
        "field": "kelly_pct",
        "operator": ">=",
        "value": "5",
        "description": "Kelly Criterion 추천 비율 5% 이상 시 알림",
    },
    {
        "id": "league_epl",
        "label": "EPL 경기",
        "rule_type": "league",
        "field": "league_name",
        "operator": "contains",
        "value": "Premier League",
        "description": "프리미어리그 밸류벳 발견 시 알림",
    },
    {
        "id": "league_laliga",
        "label": "라리가 경기",
        "rule_type": "league",
        "field": "league_name",
        "operator": "contains",
        "value": "La Liga",
        "description": "라리가 밸류벳 발견 시 알림",
    },
]


# ─── Endpoints ───

@router.get("/presets")
async def get_presets(user_id: str = Depends(require_tier("vip"))):
    """프리셋 알림 조건 목록"""
    return {"presets": PRESET_TEMPLATES}


@router.get("/rules")
async def get_rules(user_id: str = Depends(require_tier("vip"))):
    """내 커스텀 알림 규칙 조회"""
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        
        rules_ref = db.collection("alert_rules").document(user_id).collection("rules")
        docs = rules_ref.order_by("created_at").stream()
        
        rules = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            rules.append(data)
        
        return {"rules": rules, "count": len(rules)}
    except Exception as e:
        logger.error(f"Failed to get alert rules: {e}")
        return {"rules": [], "count": 0}


@router.post("/rules")
async def create_rules(
    req: CreateRulesRequest,
    user_id: str = Depends(require_tier("vip")),
):
    """커스텀 알림 규칙 생성 (최대 10개)"""
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        
        # 기존 규칙 수 확인
        rules_ref = db.collection("alert_rules").document(user_id).collection("rules")
        existing = list(rules_ref.stream())
        
        if len(existing) + len(req.rules) > 10:
            raise HTTPException(400, f"최대 10개의 규칙만 설정 가능합니다. (현재 {len(existing)}개)")
        
        created = []
        for rule in req.rules:
            rule_id = str(uuid.uuid4())[:8]
            rule_data = {
                **rule.dict(),
                "created_at": datetime.utcnow().isoformat(),
                "triggered_count": 0,
                "last_triggered": None,
            }
            rules_ref.document(rule_id).set(rule_data)
            created.append({**rule_data, "id": rule_id})
        
        return {"success": True, "created": created, "count": len(created)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create alert rules: {e}")
        raise HTTPException(500, f"규칙 생성 실패: {str(e)}")


@router.patch("/rules/{rule_id}")
async def update_rule(
    rule_id: str,
    req: UpdateRuleRequest,
    user_id: str = Depends(require_tier("vip")),
):
    """규칙 수정 (on/off 토글, 값 변경)"""
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        
        rule_ref = db.collection("alert_rules").document(user_id).collection("rules").document(rule_id)
        doc = rule_ref.get()
        
        if not doc.exists:
            raise HTTPException(404, "규칙을 찾을 수 없습니다.")
        
        update_data = {}
        if req.enabled is not None:
            update_data["enabled"] = req.enabled
        if req.label is not None:
            update_data["label"] = req.label
        if req.value is not None:
            update_data["value"] = req.value
        
        if update_data:
            rule_ref.update(update_data)
        
        return {"success": True, "rule_id": rule_id, "updated": update_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update rule: {e}")
        raise HTTPException(500, str(e))


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: str,
    user_id: str = Depends(require_tier("vip")),
):
    """규칙 삭제"""
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        
        rule_ref = db.collection("alert_rules").document(user_id).collection("rules").document(rule_id)
        doc = rule_ref.get()
        
        if not doc.exists:
            raise HTTPException(404, "규칙을 찾을 수 없습니다.")
        
        rule_ref.delete()
        return {"success": True, "deleted": rule_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete rule: {e}")
        raise HTTPException(500, str(e))


# ─── Internal: 규칙 매칭 함수 (notifications.py에서 호출) ───

async def check_user_alert_rules(match_data: dict) -> List[dict]:
    """
    밸류벳 발견 시 VIP 사용자들의 커스텀 규칙과 매칭.
    
    Returns: List of {user_id, rule, match_data} for matched rules
    """
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        
        # 모든 VIP 사용자의 규칙 조회
        alert_rules_ref = db.collection("alert_rules")
        users = alert_rules_ref.stream()
        
        matched = []
        for user_doc in users:
            user_id = user_doc.id
            rules_ref = alert_rules_ref.document(user_id).collection("rules")
            rules = rules_ref.where("enabled", "==", True).stream()
            
            for rule_doc in rules:
                rule = rule_doc.to_dict()
                if _matches_rule(rule, match_data):
                    matched.append({
                        "user_id": user_id,
                        "rule_id": rule_doc.id,
                        "rule": rule,
                        "match_data": match_data,
                    })
                    
                    # 트리거 카운트 업데이트
                    rule_doc.reference.update({
                        "triggered_count": (rule.get("triggered_count", 0) + 1),
                        "last_triggered": datetime.utcnow().isoformat(),
                    })
        
        return matched
        
    except Exception as e:
        logger.error(f"Alert rule matching error: {e}")
        return []


def _matches_rule(rule: dict, match_data: dict) -> bool:
    """규칙과 경기 데이터 매칭"""
    field = rule.get("field", "")
    op = rule.get("operator", "")
    value = rule.get("value", "")
    
    actual = match_data.get(field)
    if actual is None:
        return False
    
    try:
        if op in (">", "<", ">=", "<="):
            actual_num = float(actual)
            value_num = float(value)
            if op == ">":
                return actual_num > value_num
            elif op == "<":
                return actual_num < value_num
            elif op == ">=":
                return actual_num >= value_num
            elif op == "<=":
                return actual_num <= value_num
        elif op == "==":
            return str(actual).lower() == str(value).lower()
        elif op == "contains":
            return str(value).lower() in str(actual).lower()
    except (ValueError, TypeError):
        return False
    
    return False
