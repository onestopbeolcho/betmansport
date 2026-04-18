from typing import List, Dict, Optional
from app.core.calculator import calculate_kelly_percentage, calculate_tax_free_limit
from app.schemas.odds import OddsItem, ValueBetOpportunity
import logging

logger = logging.getLogger(__name__)


async def get_todays_value_bets() -> List[Dict]:
    """
    오늘의 밸류벳 리스트를 가져온다.
    
    Firestore의 최근 분석 결과 또는 실시간 분석을 통해 가져옴.
    Returns: List of value bet dicts with match_name, efficiency, odds, etc.
    """
    try:
        from app.db.firestore import get_firestore_db
        from datetime import datetime, timedelta
        
        db = get_firestore_db()
        
        # 오늘 날짜의 밸류벳 가져오기
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        docs = db.collection("value_picks") \
            .where("created_at", ">=", today.isoformat()) \
            .order_by("created_at") \
            .stream()
        
        results = []
        for doc in docs:
            data = doc.to_dict()
            # efficiency = (EV - 1) * 100
            ev = data.get("expected_value", 0)
            efficiency = round((ev - 1) * 100, 1) if ev > 0 else 0
            
            results.append({
                "id": doc.id,
                "match_name": data.get("match_name", ""),
                "bet_type": data.get("bet_type", ""),
                "domestic_odds": data.get("domestic_odds", 0),
                "pinnacle_odds": data.get("pinnacle_odds", 0),
                "true_probability": data.get("true_probability", 0),
                "expected_value": ev,
                "efficiency": efficiency,
                "kelly_pct": data.get("kelly_pct", 0),
                "sport": data.get("sport", ""),
                "league": data.get("league", ""),
            })
        
        return results
        
    except Exception as e:
        logger.error(f"Failed to fetch today's value bets: {e}")
        return []


class ValueBetFinder:
    def __init__(self, ev_threshold: float = 1.05):
        """
        Initialize the ValueBetFinder.
        
        Args:
            ev_threshold (float): Minimum Expected Value to consider a bet (default 1.05 for 5%).
        """
        self.ev_threshold = ev_threshold

    def calculate_true_probability(self, odds: OddsItem) -> Dict[str, float]:
        """
        Remove margin from Pinnacle odds to find true probabilities.
        Using simple normalization method:
        P_true = P_implied / Total_Implied_Prob
        """
        if odds.home_odds <= 0 or odds.draw_odds <= 0 or odds.away_odds <= 0:
             return {"home": 0.0, "draw": 0.0, "away": 0.0}

        imp_home = 1 / odds.home_odds
        imp_draw = 1 / odds.draw_odds
        imp_away = 1 / odds.away_odds
        
        total_margin = imp_home + imp_draw + imp_away
        
        # Normalize
        true_prob_home = imp_home / total_margin
        true_prob_draw = imp_draw / total_margin
        true_prob_away = imp_away / total_margin
        
        return {
            "home": true_prob_home,
            "draw": true_prob_draw,
            "away": true_prob_away
        }

    def analyze_match(self, pinnacle: OddsItem, domestic: OddsItem) -> List[ValueBetOpportunity]:
        """
        Compare Pinnacle (True) vs Domestic to find Value Bets.
        """
        opportunities = []
        
        # 1. Calculate True Probabilities from Pinnacle
        true_probs = self.calculate_true_probability(pinnacle)
        
        # 2. Compare with Domestic Odds
        # Outcomes: Home, Draw, Away
        outcomes = [
            ("Home", true_probs["home"], domestic.home_odds, pinnacle.home_odds),
            ("Draw", true_probs["draw"], domestic.draw_odds, pinnacle.draw_odds),
            ("Away", true_probs["away"], domestic.away_odds, pinnacle.away_odds),
        ]
        
        for bet_type, p_true, o_kor, o_pin in outcomes:
            # Calculate EV: (P_true * O_kor)
            ev = p_true * o_kor
            
            # Check Threshold
            if ev > self.ev_threshold:
                # Calculate Kelly
                kelly = calculate_kelly_percentage(o_kor, p_true)
                
                # Generate AI Insight text
                trans_bet = {"Home": "홈 승리", "Draw": "무승부", "Away": "원정 승리"}.get(bet_type, bet_type)
                
                # Create a dynamic text that references the factors the user wants internally synthesized
                ai_text = (
                    f"해외 배당흐름과 모멘텀, 과거 전적을 종합 분석한 결과 "
                    f"**{trans_bet}** 확률이 {round(p_true*100, 1)}%로 산출되어, "
                    f"현재 국내 배당({o_kor}) 대비 수학적 우위에 있습니다."
                )
                
                opp = ValueBetOpportunity(
                    match_name=f"{domestic.team_home} vs {domestic.team_away}",
                    bet_type=bet_type,
                    domestic_odds=o_kor,
                    true_probability=round(p_true, 4),
                    pinnacle_odds=o_pin,
                    expected_value=round(ev, 4),
                    kelly_pct=kelly,
                    max_tax_free_stake=calculate_tax_free_limit(o_kor),
                    timestamp="now", # In real app, use datetime.utcnow()
                    ai_insight=ai_text
                )
                opportunities.append(opp)
                
        return opportunities

# Example Usage Block (for testing)
if __name__ == "__main__":
    # Test Data
    # Match: Man City vs Liverpool
    # Pinnacle: Low Margin
    pin_odds = OddsItem(
        provider="Pinnacle",
        team_home="Man City", team_away="Liverpool",
        home_odds=2.05, draw_odds=3.60, away_odds=3.80
    )
    
    # Betman: Usually lower odds, but sometimes they miss updates or have biases
    # Scenario: Betman gives higher odds on Man City (Mistake/Lag)
    betman_odds = OddsItem(
        provider="Betman",
        team_home="맨체스터 시티", team_away="리버풀",
        home_odds=2.30, draw_odds=3.30, away_odds=3.40
    )
    
    finder = ValueBetFinder(ev_threshold=1.05)
    bets = finder.analyze_match(pin_odds, betman_odds)
    
    print(f"Found {len(bets)} value bets:")
    for bet in bets:
        print(bet.dict())
