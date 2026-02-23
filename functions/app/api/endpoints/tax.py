"""
Tax Calculator API — Korean Sports Betting Tax Optimization
배트맨(Betman) 세금 규정:
1. 적중금 200만원 초과 → 22% 기타소득세
2. 배당률 100배 초과 + 적중금 10만원 초과 → 22% 기타소득세
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class CartItemInput(BaseModel):
    match_name: str
    selection: str  # Home / Draw / Away
    odds: float


class TaxCalcRequest(BaseModel):
    items: List[CartItemInput]
    stake: int  # 베팅 금액 (원)


class TaxOptimization(BaseModel):
    strategy: str
    description: str
    combined_odds: float
    stake: int
    gross_return: int
    tax: int
    net_return: int
    is_taxed: bool
    removed_items: List[str]  # 제거된 경기명


class TaxCalcResponse(BaseModel):
    # 원래 조합 분석
    original_combined_odds: float
    original_gross_return: int
    original_tax: int
    original_net_return: int
    original_is_taxed: bool
    tax_reason: Optional[str]
    # 최적화 제안들
    optimizations: List[TaxOptimization]
    # 최적 제안
    best_strategy: Optional[str]
    savings: int  # 절세 금액


def calculate_tax(combined_odds: float, gross_return: int) -> tuple[int, bool, str]:
    """
    배트맨 세금 계산
    Returns: (세금액, 과세여부, 과세사유)
    """
    tax = 0
    is_taxed = False
    reason = ""

    # 조건 1: 적중금 200만원 초과
    if gross_return > 2_000_000:
        taxable_amount = gross_return - gross_return  # 기타소득세는 적중금 전체에서 투자금 차감 후
        tax = int(gross_return * 0.22)
        is_taxed = True
        reason = f"적중금 {gross_return:,}원 > 200만원 초과"

    # 조건 2: 배당률 100배 초과 + 적중금 10만원 초과
    elif combined_odds > 100 and gross_return > 100_000:
        tax = int(gross_return * 0.22)
        is_taxed = True
        reason = f"배당률 {combined_odds:.1f}배 > 100배 & 적중금 {gross_return:,}원 > 10만원"

    return tax, is_taxed, reason


@router.post("/calculate", response_model=TaxCalcResponse)
async def calculate_tax_optimization(req: TaxCalcRequest):
    """
    세금 최적화 계산:
    1. 현재 조합의 세금을 계산
    2. 경기를 하나씩 빼면서 비과세 조합을 찾음
    3. 베팅 금액을 줄여서 비과세가 되는 금액도 계산
    """
    items = req.items
    stake = req.stake

    if not items:
        return TaxCalcResponse(
            original_combined_odds=0,
            original_gross_return=0,
            original_tax=0,
            original_net_return=0,
            original_is_taxed=False,
            tax_reason=None,
            optimizations=[],
            best_strategy=None,
            savings=0,
        )

    # 1. 원래 조합 계산
    original_odds = 1.0
    for item in items:
        original_odds *= item.odds
    original_odds = round(original_odds, 2)

    original_gross = int(stake * original_odds)
    original_tax, original_is_taxed, tax_reason = calculate_tax(original_odds, original_gross)
    original_net = original_gross - original_tax

    optimizations: List[TaxOptimization] = []

    # 과세 대상이 아니면 최적화 불필요
    if not original_is_taxed:
        return TaxCalcResponse(
            original_combined_odds=original_odds,
            original_gross_return=original_gross,
            original_tax=0,
            original_net_return=original_gross,
            original_is_taxed=False,
            tax_reason=None,
            optimizations=[],
            best_strategy=None,
            savings=0,
        )

    # 2. 전략 A: 경기 하나씩 빼보기
    if len(items) > 1:
        for i in range(len(items)):
            remaining = [item for j, item in enumerate(items) if j != i]
            new_odds = 1.0
            for item in remaining:
                new_odds *= item.odds
            new_odds = round(new_odds, 2)
            new_gross = int(stake * new_odds)
            new_tax, new_is_taxed, _ = calculate_tax(new_odds, new_gross)
            new_net = new_gross - new_tax

            if new_net > original_net or not new_is_taxed:
                optimizations.append(TaxOptimization(
                    strategy="경기 제거",
                    description=f"'{items[i].match_name}' 제거 → {len(remaining)}폴더",
                    combined_odds=new_odds,
                    stake=stake,
                    gross_return=new_gross,
                    tax=new_tax,
                    net_return=new_net,
                    is_taxed=new_is_taxed,
                    removed_items=[items[i].match_name],
                ))

    # 3. 전략 B: 베팅 금액 줄이기 (비과세 한도 찾기)
    if original_odds > 100:
        # 배당 100배 초과 시, 적중금 10만원 이하로 맞추기
        max_stake_for_no_tax = int(100_000 / original_odds)
        if max_stake_for_no_tax > 0 and max_stake_for_no_tax < stake:
            safe_gross = int(max_stake_for_no_tax * original_odds)
            optimizations.append(TaxOptimization(
                strategy="금액 조절",
                description=f"베팅금 {max_stake_for_no_tax:,}원으로 줄여 비과세",
                combined_odds=original_odds,
                stake=max_stake_for_no_tax,
                gross_return=safe_gross,
                tax=0,
                net_return=safe_gross,
                is_taxed=False,
                removed_items=[],
            ))
    else:
        # 200만원 이하로 맞추기
        max_stake_for_no_tax = int(2_000_000 / original_odds)
        if max_stake_for_no_tax > 0 and max_stake_for_no_tax < stake:
            safe_gross = int(max_stake_for_no_tax * original_odds)
            optimizations.append(TaxOptimization(
                strategy="금액 조절",
                description=f"베팅금 {max_stake_for_no_tax:,}원으로 줄여 비과세",
                combined_odds=original_odds,
                stake=max_stake_for_no_tax,
                gross_return=safe_gross,
                tax=0,
                net_return=safe_gross,
                is_taxed=False,
                removed_items=[],
            ))

    # 4. 전략 C: 금액 분할 (2회 분할 구매)
    if stake > 10000:
        split_stake = stake // 2
        split_gross = int(split_stake * original_odds)
        split_tax, split_taxed, _ = calculate_tax(original_odds, split_gross)
        total_net = (split_gross - split_tax) * 2

        if total_net > original_net:
            optimizations.append(TaxOptimization(
                strategy="분할 구매",
                description=f"{split_stake:,}원 × 2회 분할 구매",
                combined_odds=original_odds,
                stake=split_stake,
                gross_return=split_gross * 2,
                tax=split_tax * 2,
                net_return=total_net,
                is_taxed=split_taxed,
                removed_items=[],
            ))

    # 5. 최적 전략 선택
    best = None
    best_savings = 0
    for opt in optimizations:
        savings = opt.net_return - original_net
        if savings > best_savings:
            best_savings = savings
            best = opt.strategy + ": " + opt.description

    return TaxCalcResponse(
        original_combined_odds=original_odds,
        original_gross_return=original_gross,
        original_tax=original_tax,
        original_net_return=original_net,
        original_is_taxed=True,
        tax_reason=tax_reason,
        optimizations=optimizations,
        best_strategy=best,
        savings=best_savings,
    )
