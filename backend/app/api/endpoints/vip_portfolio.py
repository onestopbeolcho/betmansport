"""
VIP 포트폴리오 자동 최적화 API

Kelly Criterion 기반 자동 자금 배분 추천:
- 총 자금 입력 → 경기별 최적 배팅액 산출
- 리스크 분석 (최대 드로다운, 분산 지표)
- 포트폴리오 성과 통계
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import logging
import math

from app.core.calculator import calculate_kelly_percentage
from app.core.tier_guard import require_tier

router = APIRouter()
logger = logging.getLogger(__name__)


# ─── Schemas ───

class BetInput(BaseModel):
    match_name: str
    selection: str
    odds: float
    true_probability: float  # 0~1
    league: str = ""


class OptimizeRequest(BaseModel):
    """포트폴리오 최적화 요청"""
    total_bankroll: int = 100_000  # 총 자금 (원)
    bets: List[BetInput]
    risk_level: str = "moderate"  # conservative, moderate, aggressive
    max_per_bet_pct: float = 25.0  # 경기당 최대 배분 %


# ─── Risk level → Kelly fraction mapping ───
RISK_FRACTIONS = {
    "conservative": 0.15,   # 1/6.7 Kelly
    "moderate": 0.25,       # 1/4 Kelly
    "aggressive": 0.50,     # 1/2 Kelly
}


# ─── Endpoints ───

@router.post("/optimize")
async def optimize_portfolio(
    req: OptimizeRequest,
    user_id: str = Depends(require_tier("pro")),
):
    """
    🏆 Kelly Criterion 기반 자금 배분 최적화.
    
    각 경기별 최적 배팅액, 예상 수익/손실, 리스크 점수를 계산.
    """
    if not req.bets:
        raise HTTPException(400, "최소 1개 이상의 경기를 입력해야 합니다.")
    if req.total_bankroll < 1000:
        raise HTTPException(400, "최소 투자금은 1,000원입니다.")
    
    fraction = RISK_FRACTIONS.get(req.risk_level, 0.25)
    max_per_bet = req.max_per_bet_pct / 100.0
    
    allocations = []
    total_allocated = 0
    total_expected_profit = 0
    total_risk_score = 0
    
    for bet in req.bets:
        if bet.odds <= 1.0 or bet.true_probability <= 0 or bet.true_probability >= 1:
            allocations.append({
                "match_name": bet.match_name,
                "selection": bet.selection,
                "odds": bet.odds,
                "true_probability": round(bet.true_probability * 100, 1),
                "kelly_raw": 0,
                "kelly_adjusted": 0,
                "recommended_stake": 0,
                "allocation_pct": 0,
                "expected_value": 0,
                "expected_profit": 0,
                "risk_score": 0,
                "status": "skip",
                "reason": "유효하지 않은 배당/확률",
            })
            continue
        
        # Raw Kelly
        b = bet.odds - 1
        p = bet.true_probability
        q = 1 - p
        kelly_raw = (b * p - q) / b if b > 0 else 0
        
        if kelly_raw <= 0:
            allocations.append({
                "match_name": bet.match_name,
                "selection": bet.selection,
                "odds": bet.odds,
                "true_probability": round(bet.true_probability * 100, 1),
                "kelly_raw": round(kelly_raw * 100, 2),
                "kelly_adjusted": 0,
                "recommended_stake": 0,
                "allocation_pct": 0,
                "expected_value": round(bet.odds * p, 4),
                "expected_profit": 0,
                "risk_score": 0,
                "status": "negative_ev",
                "reason": "기대값 음수 — 배팅 비추천",
            })
            continue
        
        # Fractional Kelly (risk-adjusted)
        kelly_adj = min(kelly_raw * fraction, max_per_bet)
        stake = max(100, int(req.total_bankroll * kelly_adj))
        stake = min(stake, req.total_bankroll - total_allocated)
        
        if stake < 100:
            stake = 0
        
        # Expected Value
        ev = bet.odds * p  # EV per unit wagered
        expected_profit = int(stake * (ev - 1)) if stake > 0 else 0
        
        # Risk score (0~100): higher = riskier
        variance = p * (b ** 2) + q * 1  # simplified variance
        risk_score = min(100, int(math.sqrt(variance) * 50))
        
        total_allocated += stake
        total_expected_profit += expected_profit
        total_risk_score += risk_score
        
        allocations.append({
            "match_name": bet.match_name,
            "selection": bet.selection,
            "odds": bet.odds,
            "true_probability": round(p * 100, 1),
            "kelly_raw": round(kelly_raw * 100, 2),
            "kelly_adjusted": round(kelly_adj * 100, 2),
            "recommended_stake": stake,
            "allocation_pct": round(stake / req.total_bankroll * 100, 1) if req.total_bankroll > 0 else 0,
            "expected_value": round(ev, 4),
            "expected_profit": expected_profit,
            "risk_score": risk_score,
            "status": "recommended",
            "league": bet.league,
        })
    
    # Sort by Kelly (highest first)
    allocations.sort(key=lambda x: x.get("kelly_adjusted", 0), reverse=True)
    
    # Portfolio summary
    recommended_count = sum(1 for a in allocations if a.get("status") == "recommended")
    avg_risk = total_risk_score / recommended_count if recommended_count > 0 else 0
    
    # Max potential drawdown estimate (simplified)
    max_drawdown = sum(
        a["recommended_stake"] for a in allocations 
        if a.get("status") == "recommended"
    )
    
    return {
        "success": True,
        "allocations": allocations,
        "summary": {
            "total_bankroll": req.total_bankroll,
            "total_allocated": total_allocated,
            "remaining_cash": req.total_bankroll - total_allocated,
            "cash_reserve_pct": round((1 - total_allocated / req.total_bankroll) * 100, 1) if req.total_bankroll > 0 else 100,
            "recommended_bets": recommended_count,
            "skipped_bets": len(allocations) - recommended_count,
            "total_expected_profit": total_expected_profit,
            "expected_roi": round(total_expected_profit / total_allocated * 100, 1) if total_allocated > 0 else 0,
            "avg_risk_score": round(avg_risk, 1),
            "max_potential_loss": max_drawdown,
            "risk_level": req.risk_level,
            "kelly_fraction": fraction,
        },
    }


@router.get("/stats")
async def get_portfolio_stats(
    days: int = 30,
    user_id: str = Depends(require_tier("pro")),
):
    """
    📊 포트폴리오 성과 통계.
    
    승률, 총 수익률, 최대 드로다운, 결과 분석.
    """
    try:
        from app.db.firestore import get_firestore_db
        db = get_firestore_db()
        
        # 과거 베팅 기록 조회
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        
        portfolio_ref = db.collection("portfolios").document(user_id).collection("items")
        docs = portfolio_ref.where("created_at", ">=", cutoff).stream()
        
        items = []
        for doc in docs:
            items.append(doc.to_dict())
        
        if not items:
            return {
                "success": True,
                "period_days": days,
                "stats": {
                    "total_bets": 0,
                    "message": "해당 기간 내 기록이 없습니다.",
                },
            }
        
        # 통계 계산
        total_bets = len(items)
        wins = sum(1 for i in items if i.get("result") == "win")
        losses = sum(1 for i in items if i.get("result") == "loss")
        pending = sum(1 for i in items if i.get("result") in ("pending", None))
        
        total_staked = sum(i.get("stake", 0) for i in items)
        total_profit = sum(i.get("profit", 0) for i in items)
        
        # Running P&L for drawdown calc
        running_pnl = 0
        peak = 0
        max_drawdown = 0
        for item in sorted(items, key=lambda x: x.get("created_at", "")):
            running_pnl += item.get("profit", 0)
            if running_pnl > peak:
                peak = running_pnl
            dd = peak - running_pnl
            if dd > max_drawdown:
                max_drawdown = dd
        
        win_rate = round(wins / (wins + losses) * 100, 1) if (wins + losses) > 0 else 0
        roi = round(total_profit / total_staked * 100, 1) if total_staked > 0 else 0
        avg_odds = sum(i.get("odds", 0) for i in items) / total_bets if total_bets > 0 else 0
        
        return {
            "success": True,
            "period_days": days,
            "stats": {
                "total_bets": total_bets,
                "wins": wins,
                "losses": losses,
                "pending": pending,
                "win_rate": win_rate,
                "total_staked": total_staked,
                "total_profit": total_profit,
                "roi": roi,
                "max_drawdown": max_drawdown,
                "avg_odds": round(avg_odds, 2),
                "best_bet": max(items, key=lambda x: x.get("profit", 0)).get("match_name", "N/A") if items else "N/A",
                "worst_bet": min(items, key=lambda x: x.get("profit", 0)).get("match_name", "N/A") if items else "N/A",
            },
        }
        
    except Exception as e:
        logger.error(f"Portfolio stats error: {e}")
        return {
            "success": True,
            "period_days": days,
            "stats": {
                "total_bets": 0,
                "message": "통계 데이터를 불러올 수 없습니다.",
            },
        }
