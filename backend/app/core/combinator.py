"""
Smart Combinator — 지능형 토토 조합기

핵심 기능:
1. 켈리 기준(Kelly Criterion) 기반 최적 배분
2. 세금 회피 최적화 (200만원 / 100배당+10만원 기준)
3. 크로스 베팅 차단 (동일경기 승무패+언오버 불가)
4. 회차당 10만원 한도 준수
5. 분산 투자(MPT) 기반 위험 관리

배트맨 세금 규정:
- 당첨금 200만원 초과 시: 22% 세금
- 배당률 100배 초과 + 환급금 10만원 이상 시: 22% 세금
- 소액 분산 전략으로 세금 구간 회피
"""
import logging
import math
from typing import List, Dict, Optional, Tuple
from itertools import combinations

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# 규제 상수
# ──────────────────────────────────────────────
MAX_STAKE_PER_ROUND = 100_000       # 회차당 10만원 한도
TAX_THRESHOLD_WINNINGS = 2_000_000  # 당첨금 200만원 초과 시 세금
TAX_THRESHOLD_ODDS = 100            # 배당률 100배 초과 시
TAX_THRESHOLD_RETURN = 100_000      # 환급금 10만원 이상 시
TAX_RATE = 0.22                     # 22% 세금
MIN_BET_AMOUNT = 100                # 최소 베팅 100원
MAX_COMBO_SIZE = 10                 # 최대 조합 경기 수
MIN_COMBO_SIZE = 2                  # 최소 조합 경기 수


class BetItem:
    """개별 경기 베팅 선택"""
    def __init__(self, match_id: str, match_name: str, selection: str,
                 odds: float, sport: str = "", league: str = "",
                 team_home: str = "", team_away: str = "",
                 market_type: str = "h2h"):
        self.match_id = match_id
        self.match_name = match_name
        self.selection = selection
        self.odds = odds
        self.sport = sport
        self.league = league
        self.team_home = team_home
        self.team_away = team_away
        self.market_type = market_type  # 'h2h' (승무패) or 'totals' (언더오버)

    def to_dict(self) -> dict:
        return {
            "match_id": self.match_id,
            "match_name": self.match_name,
            "selection": self.selection,
            "odds": self.odds,
            "sport": self.sport,
            "league": self.league,
            "team_home": self.team_home,
            "team_away": self.team_away,
            "market_type": self.market_type,
        }


class ComboResult:
    """조합기 결과"""
    def __init__(self):
        self.combos: List[Dict] = []
        self.total_stake: int = 0
        self.validation_errors: List[str] = []
        self.tax_strategy: Dict = {}
        self.summary: Dict = {}


class SmartCombinator:
    """
    지능형 토토 조합기.
    
    Usage:
        combinator = SmartCombinator()
        items = [BetItem(...), BetItem(...), ...]
        result = combinator.optimize(items, total_budget=100000)
    """

    def __init__(self):
        self.max_stake = MAX_STAKE_PER_ROUND

    # ──────────────────────────────────────────────
    # 1. 입력 검증
    # ──────────────────────────────────────────────
    def validate(self, items: List[BetItem]) -> List[str]:
        """
        입력 검증 — 크로스 베팅 차단 + 기본 규칙 확인.
        Returns list of error messages (empty = valid).
        """
        errors = []

        if len(items) < MIN_COMBO_SIZE:
            errors.append(f"최소 {MIN_COMBO_SIZE}개 경기 이상 선택해야 합니다.")
        if len(items) > MAX_COMBO_SIZE:
            errors.append(f"최대 {MAX_COMBO_SIZE}개 경기까지 선택 가능합니다.")

        # 크로스 베팅 검증 — 동일 경기의 다른 마켓 동시 선택 차단
        match_markets = {}
        for item in items:
            key = item.match_id or item.match_name
            if key in match_markets:
                if match_markets[key] != item.market_type:
                    errors.append(
                        f"⚠️ 크로스 베팅 불가: '{item.match_name}' 의 "
                        f"'{match_markets[key]}' + '{item.market_type}'는 배트맨에서 구매할 수 없습니다."
                    )
            else:
                match_markets[key] = item.market_type

        # 동일 경기 중복 선택 차단
        seen = set()
        for item in items:
            key = (item.match_id or item.match_name, item.selection)
            if key in seen:
                errors.append(f"⚠️ 동일 경기 동일 선택 중복: {item.match_name} ({item.selection})")
            seen.add(key)

        # 배당 유효성
        for item in items:
            if item.odds < 1.01:
                errors.append(f"배당률이 너무 낮습니다: {item.match_name} ({item.odds})")

        return errors

    # ──────────────────────────────────────────────
    # 2. 세금 계산
    # ──────────────────────────────────────────────
    def calculate_tax(self, stake: int, total_odds: float) -> Dict:
        """
        세금 계산 비활성화. 실수령액은 총 환급금과 동일.
        """
        gross_return = int(stake * total_odds)
        return {
            "gross_return": gross_return,
            "tax_amount": 0,
            "net_return": gross_return,
            "tax_applied": False,
            "tax_reason": "세금 없음",
        }

    # ──────────────────────────────────────────────
    # 3. 켈리 기준 최적 베팅 비율
    # ──────────────────────────────────────────────
    def kelly_fraction(self, odds: float, true_prob: float,
                       fraction: float = 0.25) -> float:
        """
        Fractional Kelly Criterion.
        
        Kelly % = (bp - q) / b
        where b = odds - 1, p = true_prob, q = 1 - p
        
        fraction: 보수적 배분 (0.25 = 1/4 Kelly)
        """
        if odds <= 1.0 or true_prob <= 0.0 or true_prob >= 1.0:
            return 0.0

        b = odds - 1
        p = true_prob
        q = 1 - p

        kelly = (b * p - q) / b
        if kelly <= 0:
            return 0.0

        return min(kelly * fraction, 0.25)  # Cap at 25% per bet

    # ──────────────────────────────────────────────
    # 4. 세금 회피 최적화
    # ──────────────────────────────────────────────
    def optimize_for_tax(self, items: List[BetItem], budget: int) -> List[Dict]:
        """
        세금 최적화 비활성화. 단일 조합으로 변환.
        """
        if not items:
            return []

        total_odds = 1.0
        for item in items:
            total_odds *= item.odds

        tax_info = self.calculate_tax(budget, total_odds)
        return [{
            "items": [i.to_dict() for i in items],
            "stake": budget,
            "total_odds": round(total_odds, 2),
            "expected_return": tax_info["gross_return"],
            "tax": 0,
            "net_return": tax_info["net_return"],
            "strategy": "단일 조합 (세금 없음)",
        }]

    # ──────────────────────────────────────────────
    # 5. 메인 최적화 엔트리
    # ──────────────────────────────────────────────
    def optimize(self, items: List[BetItem], total_budget: int) -> ComboResult:
        """
        Main optimization entry point.
        
        Args:
            items: List of selected BetItem objects
            total_budget: Total investment budget (원)
        
        Returns:
            ComboResult with optimized combinations
        """
        result = ComboResult()

        # 1. Validate
        errors = self.validate(items)
        if errors:
            result.validation_errors = errors
            return result

        # 2. Budget cap
        budget = min(total_budget, self.max_stake)
        result.total_stake = budget

        # 3. Calculate overall stats
        total_odds = 1.0
        for item in items:
            total_odds *= item.odds

        # 4. Implied probabilities from odds
        prob_estimates = []
        for item in items:
            implied_prob = 1.0 / item.odds if item.odds > 0 else 0
            prob_estimates.append({
                "match": item.match_name,
                "selection": item.selection,
                "odds": item.odds,
                "implied_prob": round(implied_prob * 100, 1),
            })

        # 5. Tax optimization
        combos = self.optimize_for_tax(items, budget)
        result.combos = combos

        # 6. Tax strategy summary
        total_tax_saved = 0
        original_tax = self.calculate_tax(budget, total_odds)
        optimized_tax = sum(c.get("tax", 0) for c in combos)
        total_tax_saved = original_tax["tax_amount"] - optimized_tax

        result.tax_strategy = {
            "original_tax": original_tax["tax_amount"],
            "optimized_tax": optimized_tax,
            "tax_saved": max(0, total_tax_saved),
            "strategy": "세금 분할 최적화" if total_tax_saved > 0 else "세금 영향 없음",
        }

        # 7. Summary
        total_expected = sum(c.get("expected_return", 0) for c in combos)
        total_net = sum(c.get("net_return", 0) for c in combos)

        result.summary = {
            "total_matches": len(items),
            "total_odds": round(total_odds, 2),
            "total_stake": budget,
            "expected_return": total_expected,
            "total_tax": optimized_tax,
            "net_return": total_net,
            "roi": round((total_net / budget - 1) * 100, 1) if budget > 0 else 0,
            "combo_count": len(combos),
            "prob_estimates": prob_estimates,
        }

        return result


# Singleton
smart_combinator = SmartCombinator()
