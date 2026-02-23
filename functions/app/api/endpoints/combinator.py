"""
Combinator API — 스마트 토토 조합기 엔드포인트
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
import logging

from app.core.combinator import SmartCombinator, BetItem

router = APIRouter()
logger = logging.getLogger(__name__)
_combinator = SmartCombinator()


class ComboBetInput(BaseModel):
    match_id: str = ""
    match_name: str
    selection: str           # 'Home', 'Draw', 'Away'
    odds: float
    sport: str = ""
    league: str = ""
    team_home: str = ""
    team_away: str = ""
    market_type: str = "h2h"  # 'h2h' or 'totals'


class ComboRequest(BaseModel):
    items: List[ComboBetInput]
    budget: int = 100000     # 투자금 (원)


class TaxCalcRequest(BaseModel):
    stake: int
    total_odds: float


@router.post("/optimize")
async def optimize_combo(req: ComboRequest):
    """
    스마트 조합 최적화.
    
    - 크로스 베팅 검증
    - 세금 회피 최적 분배
    - 켈리 기준 적용
    """
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

    result = _combinator.optimize(bet_items, total_budget=req.budget)

    if result.validation_errors:
        return {
            "success": False,
            "errors": result.validation_errors,
        }

    return {
        "success": True,
        "combos": result.combos,
        "tax_strategy": result.tax_strategy,
        "summary": result.summary,
    }


@router.post("/validate")
async def validate_combo(req: ComboRequest):
    """크로스 베팅 등 유효성 검사만 수행."""
    bet_items = [
        BetItem(
            match_id=item.match_id,
            match_name=item.match_name,
            selection=item.selection,
            odds=item.odds,
            market_type=item.market_type,
        )
        for item in req.items
    ]
    errors = _combinator.validate(bet_items)
    return {
        "valid": len(errors) == 0,
        "errors": errors,
    }


@router.post("/tax")
async def calculate_tax(req: TaxCalcRequest):
    """세금 시뮬레이션."""
    result = _combinator.calculate_tax(req.stake, req.total_odds)
    return result
