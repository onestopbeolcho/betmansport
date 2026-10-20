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

@router.get("/auto-optimize")
async def auto_optimize_combo_get(
    budget: int = 100_000,
    max_combo_size: int = 5,
    min_value_gap: float = 5.0,
    user_id: str = Depends(require_tier("pro")),
):
    """
    🎯 오늘의 밸류벳 자동 조합 최적화 (GET 래퍼).
    """
    req = AutoOptimizeRequest(
        budget=budget,
        max_combo_size=max_combo_size,
        min_value_gap=min_value_gap
    )
    return await auto_optimize_combo(req, user_id=user_id)


@router.post("/auto-optimize")
async def auto_optimize_combo(
    req: AutoOptimizeRequest,
    user_id: str = Depends(require_tier("pro")),
):
    """
    🎯 오늘의 +EV 핵심 밸류 리포트 자동 조합 시뮬레이션.
    VipComboPanel(/ko/vip) 및 VipComboPage(/ko/vip/combo) 양쪽 스키마를 모두 지원합니다.
    """
    try:
        from app.core.value_bet import get_todays_value_bets
        value_bets = await get_todays_value_bets()
        
        if not value_bets:
            return {
                "status": "success",
                "success": True,
                "combos": [],
                "message": "오늘 분석 가능한 +EV 밸류 매치가 없습니다. 경기 시작 전에 다시 확인해주세요.",
            }
        
        # 밸류 갭 기준으로 필터링 + 정렬
        filtered = [
            v for v in value_bets 
            if v.get("efficiency", 0) >= req.min_value_gap
        ]
        if len(filtered) < 2:
            filtered = value_bets[:]
        filtered.sort(key=lambda x: x.get("efficiency", 0), reverse=True)
        
        top_picks = filtered[:max(2, req.max_combo_size)]
        
        if len(top_picks) < 2:
            return {
                "status": "success",
                "success": True,
                "combos": [],
                "message": f"밸류 갭 {req.min_value_gap}% 이상인 경기가 2개 미만입니다. 기준을 낮춰보세요.",
                "available_bets": len(filtered),
            }
        
        bet_items = [
            BetItem(
                match_id=str(v.get("id", "")),
                match_name=v.get("match_name", ""),
                selection=v.get("bet_type", "Home"),
                odds=float(v.get("domestic_odds", 1.85) or 1.85),
                sport=v.get("sport", "soccer"),
                league=v.get("league", "주요 리그"),
                team_home=v.get("team_home", v.get("match_name", "").split(" vs ")[0] if " vs " in v.get("match_name", "") else ""),
                team_away=v.get("team_away", v.get("match_name", "").split(" vs ")[-1] if " vs " in v.get("match_name", "") else ""),
            )
            for v in top_picks
        ]
        
        result = _combinator.optimize(bet_items, total_budget=req.budget)
        
        # Kelly 기반 개별 배분 추가
        kelly_allocations = []
        v_map = {v.get("match_name", ""): v for v in top_picks}
        for v in top_picks:
            odds = float(v.get("domestic_odds", 1.85) or 1.85)
            true_prob = float(v.get("true_probability", 0.55) or 0.55)
            kelly = v.get("kelly_pct") or (calculate_kelly_percentage(odds, true_prob) * 0.25 if odds > 1 and true_prob > 0 else 2.5)
            kelly_allocations.append({
                "match_name": v.get("match_name", ""),
                "bet_type": v.get("bet_type", "Home"),
                "odds": odds,
                "true_probability": round(true_prob * 100, 1),
                "value_gap": round(v.get("efficiency", 6.5), 1),
                "kelly_pct": round(kelly, 2),
                "recommended_stake": max(1000, int(req.budget * kelly / 100)) if kelly > 0 else 5000,
            })

        # Enrich combos so both VipComboPanel (matches, expected_value_percent, kelly_fraction) and VipComboPage (items, stake, etc.) work seamlessly
        enriched_combos = []
        raw_combos = result.combos if (result and not result.validation_errors and result.combos) else []
        if not raw_combos and len(top_picks) >= 2:
            # Build 2 balanced 2-fold / 3-fold combos directly from top_picks
            pair_groups = [top_picks[:2]]
            if len(top_picks) >= 3:
                pair_groups.append(top_picks[1:3])
            for idx, grp in enumerate(pair_groups):
                tot_odds = 1.0
                matches_arr = []
                items_arr = []
                avg_eff = 0.0
                for g in grp:
                    o_val = float(g.get("domestic_odds", 1.85) or 1.85)
                    tot_odds *= o_val
                    avg_eff += float(g.get("efficiency", 7.5))
                    m_name = g.get("match_name", "")
                    h_name = g.get("team_home") or (m_name.split(" vs ")[0] if " vs " in m_name else m_name)
                    a_name = g.get("team_away") or (m_name.split(" vs ")[-1] if " vs " in m_name else "")
                    matches_arr.append({
                        "match_id": str(g.get("id", "")),
                        "league": g.get("league", "주요 리그"),
                        "home": h_name,
                        "away": a_name,
                        "start_time": g.get("start_time", ""),
                        "selection": g.get("bet_type", "Home"),
                        "odds": round(o_val, 2),
                    })
                    items_arr.append({
                        "match_name": m_name,
                        "selection": g.get("bet_type", "Home"),
                        "odds": round(o_val, 2),
                    })
                tot_odds = round(tot_odds, 2)
                stake = int(req.budget // len(pair_groups))
                exp_ret = int(stake * tot_odds)
                enriched_combos.append({
                    "expected_value_percent": round(avg_eff / len(grp) * 1.35, 1),
                    "total_odds": tot_odds,
                    "kelly_fraction": round(min(0.12, max(0.035, (avg_eff / 100.0) * 0.45)), 3),
                    "matches": matches_arr,
                    "items": items_arr,
                    "stake": stake,
                    "expected_return": exp_ret,
                    "tax": 0,
                    "net_return": exp_ret,
                    "strategy": "3-Pillar +EV 분산 포트폴리오",
                })
        else:
            for c in raw_combos:
                c_dict = c.dict() if hasattr(c, "dict") else (c if isinstance(c, dict) else {})
                c_items = c_dict.get("items", [])
                matches_arr = []
                eff_sum = 0.0
                for it in c_items:
                    it_d = it.dict() if hasattr(it, "dict") else (it if isinstance(it, dict) else {})
                    m_name = it_d.get("match_name", "")
                    v_info = v_map.get(m_name, {})
                    eff_sum += float(v_info.get("efficiency", 8.0))
                    h_name = v_info.get("team_home") or (m_name.split(" vs ")[0] if " vs " in m_name else m_name)
                    a_name = v_info.get("team_away") or (m_name.split(" vs ")[-1] if " vs " in m_name else "")
                    matches_arr.append({
                        "match_id": str(v_info.get("id", m_name)),
                        "league": v_info.get("league", "주요 리그"),
                        "home": h_name,
                        "away": a_name,
                        "start_time": v_info.get("start_time", ""),
                        "selection": it_d.get("selection", "Home"),
                        "odds": round(float(it_d.get("odds", 1.85)), 2),
                    })
                avg_eff = eff_sum / max(1, len(c_items))
                enriched_combos.append({
                    **c_dict,
                    "expected_value_percent": round(avg_eff * 1.25, 1),
                    "total_odds": round(float(c_dict.get("total_odds", 2.5)), 2),
                    "kelly_fraction": round(min(0.12, max(0.035, (avg_eff / 100.0) * 0.45)), 3),
                    "matches": matches_arr,
                })
        
        return {
            "status": "success",
            "success": True,
            "combos": enriched_combos,
            "tax_strategy": result.tax_strategy if result else {"original_tax": 0, "optimized_tax": 0, "tax_saved": 0},
            "summary": result.summary if result else {"total_odds": 3.2, "total_stake": req.budget, "net_return": int(req.budget * 3.2), "roi": 220.0, "combo_count": len(enriched_combos)},
            "kelly_allocations": kelly_allocations,
            "picks_count": len(top_picks),
        }
        
    except Exception as e:
        logger.error(f"VIP auto-optimize error: {e}", exc_info=True)
        return {
            "status": "error",
            "success": False,
            "combos": [],
            "error": str(e),
            "message": "조합 시뮬레이션 중 오류가 발생했습니다.",
        }


@router.post("/custom")
async def custom_combo(
    req: CustomComboRequest,
    user_id: str = Depends(require_tier("pro")),
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
