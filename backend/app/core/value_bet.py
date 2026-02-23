from typing import List, Dict, Optional
from app.core.calculator import calculate_kelly_percentage, calculate_tax_free_limit
from app.schemas.odds import OddsItem, ValueBetOpportunity


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
                
                opp = ValueBetOpportunity(
                    match_name=f"{domestic.team_home} vs {domestic.team_away}",
                    bet_type=bet_type,
                    domestic_odds=o_kor,
                    true_probability=round(p_true, 4),
                    pinnacle_odds=o_pin,
                    expected_value=round(ev, 4),
                    kelly_pct=kelly,
                    max_tax_free_stake=calculate_tax_free_limit(o_kor),
                    timestamp="now" # In real app, use datetime.utcnow()
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
