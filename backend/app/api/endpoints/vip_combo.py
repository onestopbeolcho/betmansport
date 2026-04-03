"""
VIP AI 조합 분석 API — 멀티 경기 최적 조합 + Kelly 기반 배분

Pro: 단일 경기 분석만 가능
VIP: 멀티 경기 조합 최적화 (세금 회피 + Kelly 배분)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging

from app.core.combinator import SmartCombinator, BetItem
from app.core.calculator import calculate_kelly_percentage
from app.core.tier_guard import require_tier

router = APIRouter()
logger = logging.getLogger(__name__)
_combinator = SmartCombinator()


# ─── Schemas ───

class VipBetInput(BaseModel):
    match_id: str = ""
    match_name: str
    selection: str           # 'Home', 'Draw', 'Away'
    odds: float              # 배트맨 배당
    true_probability: float = 0.0  # Pinnacle 기반 실제 확률 (0~1)
    sport: str = ""
    league: str = ""
    team_home: str = ""
    team_away: str = ""
    market_type: str = "h2h"


class AutoOptimizeRequest(BaseModel):
    """자동 최적화 요청 — 오늘의 밸류벳에서 자동 선택"""
    budget: int = 100_000
    max_combo_size: int = 5
    min_value_gap: float = 5.0  # 최소 밸류 갭 %


class CustomComboRequest(BaseModel):
    """사용자 커스텀 조합 요청"""
    items: List[VipBetInput]
    budget: int = 100_000


# ─── Endpoints ───

@router.post("/auto-optimize")
async def auto_optimize_combo(
    req: AutoOptimizeRequest,
    user_id: str = Depends(require_tier("vip")),
):
    """
    🎯 오늘의 밸류벳 자동 조합 최적화.
    
    1. 오늘의 밸류벳 데이터에서 EV 높은 경기 자동 선택
    2. Kelly 기반 최적 조합 생성
    3. 세금 최적화 적용
    """
    try:
        # 오늘의 밸류벳 데이터 가져오기
        from app.core.value_bet import get_todays_value_bets
        value_bets = await get_todays_value_bets()
        
        if not value_bets:
            return {
                "success": True,
                "combos": [],
                "message": "오늘 분석 가능한 밸류벳이 없습니다. 경기 시작 전에 다시 확인해주세요.",
            }
        
        # 밸류 갭 기준으로 필터링 + 정렬
        filtered = [
            v for v in value_bets 
            if v.get("efficiency", 0) >= req.min_value_gap
        ]
        filtered.sort(key=lambda x: x.get("efficiency", 0), reverse=True)
        
        # 상위 N개 선택
        top_picks = filtered[:req.max_combo_size]
        
        if len(top_picks) < 2:
            return {
                "success": True,
                "combos": [],
                "message": f"밸류 갭 {req.min_value_gap}% 이상인 경기가 2개 미만입니다. 기준을 낮춰보세요.",
                "available_bets": len(filtered),
            }
        
        # BetItem으로 변환
        bet_items = [
            BetItem(
                match_id=str(v.get("id", "")),
                match_name=v.get("match_name", ""),
                selection=v.get("bet_type", "Home"),
                odds=v.get("domestic_odds", 0),
                sport=v.get("sport", ""),
                league=v.get("league", ""),
            )
            for v in top_picks
        ]
        
        # 조합 최적화
        result = _combinator.optimize(bet_items, total_budget=req.budget)
        
        if result.validation_errors:
            return {"success": False, "errors": result.validation_errors}
        
        # Kelly 기반 개별 배분 추가
        kelly_allocations = []
        for v in top_picks:
            odds = v.get("domestic_odds", 0)
            true_prob = v.get("true_probability", 0)
            kelly = calculate_kelly_percentage(odds, true_prob) if odds > 1 and true_prob > 0 else 0
            kelly_allocations.append({
                "match_name": v.get("match_name", ""),
                "bet_type": v.get("bet_type", ""),
                "odds": odds,
                "true_probability": round(true_prob * 100, 1),
                "value_gap": round(v.get("efficiency", 0), 1),
                "kelly_pct": round(kelly, 2),
                "recommended_stake": max(100, int(req.budget * kelly / 100)) if kelly > 0 else 0,
            })
        
        return {
            "success": True,
            "combos": result.combos,
            "tax_strategy": result.tax_strategy,
            "summary": result.summary,
            "kelly_allocations": kelly_allocations,
            "picks_count": len(top_picks),
        }
        
    except Exception as e:
        logger.error(f"VIP auto-optimize error: {e}")
        return {
            "success": False,
            "error": str(e),
            "message": "조합 최적화 중 오류가 발생했습니다.",
        }


@router.post("/custom")
async def custom_combo(
    req: CustomComboRequest,
    user_id: str = Depends(require_tier("vip")),
):
    """
    🎯 사용자 선택 경기 커스텀 조합 최적화.
    
    - 경기 상관관계 분석
    - Kelly 기반 최적 배팅금 산출
    - 세금 회피 전략
    """
    if len(req.items) < 2:
        raise HTTPException(400, "최소 2개 이상의 경기를 선택해야 합니다.")
    if len(req.items) > 10:
        raise HTTPException(400, "최대 10개까지 선택 가능합니다.")
    
    bet_items = [
        BetItem(
            match_id=item.match_id,
            match_name=item.match_name,
            selection=item.selection,
            odds=item.odds,
            sport=item.sport,
            league=item.league,
            team_home=item.team_home,
            team_away=item.team_away,
            market_type=item.market_type,
        )
        for item in req.items
    ]
    
    # 조합 최적화
    result = _combinator.optimize(bet_items, total_budget=req.budget)
    
    if result.validation_errors:
        return {"success": False, "errors": result.validation_errors}
    
    # 개별 Kelly 분석
    kelly_breakdown = []
    for item in req.items:
        if item.true_probability > 0 and item.odds > 1:
            kelly = calculate_kelly_percentage(item.odds, item.true_probability)
        else:
            kelly = 0
        
        kelly_breakdown.append({
            "match_name": item.match_name,
            "selection": item.selection,
            "odds": item.odds,
            "true_probability": round(item.true_probability * 100, 1),
            "kelly_pct": round(kelly, 2),
            "recommended_stake": max(100, int(req.budget * kelly / 100)) if kelly > 0 else 0,
        })
    
    # 리그 상관관계 체크
    leagues = [item.league for item in req.items if item.league]
    league_counts = {}
    for lg in leagues:
        league_counts[lg] = league_counts.get(lg, 0) + 1
    
    correlation_warning = None
    for lg, count in league_counts.items():
        if count >= 3:
            correlation_warning = f"⚠️ {lg} 리그에서 {count}경기 선택 — 동일 리그 경기는 상관관계가 높아 리스크가 증가할 수 있습니다."
    
    return {
        "success": True,
        "combos": result.combos,
        "tax_strategy": result.tax_strategy,
        "summary": result.summary,
        "kelly_breakdown": kelly_breakdown,
        "correlation_warning": correlation_warning,
    }
