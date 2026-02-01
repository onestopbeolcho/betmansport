import sys
import os

# Ensure backend directory is in python path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.pinnacle_api import PinnacleService
from app.services.crawler_betman import BetmanCrawler
from app.services.team_mapper import TeamMapper
from app.core.value_bet import ValueBetFinder
from app.schemas.odds import OddsItem

def run_pipeline():
    print(">>> Starting Pipeline Verification...")
    
    # 1. Initialize Services
    pin_service = PinnacleService()
    betman_service = BetmanCrawler()
    mapper = TeamMapper()
    finder = ValueBetFinder(ev_threshold=1.05)
    
    # 2. Fetch Data (Mock)
    print(">>> Fetching Odds...")
    pin_odds_list = pin_service.fetch_odds()
    betman_odds_list = betman_service.fetch_odds()
    print(f"Fetched {len(pin_odds_list)} matches from Pinnacle")
    print(f"Fetched {len(betman_odds_list)} matches from Betman")
    
    # 3. Match and Analyze
    print("\n>>> Analyzing Matches...")
    value_bets = []
    
    for pin_match in pin_odds_list:
        # Map Team Names to Korean
        kor_home = mapper.get_korean_name(pin_match.team_home)
        kor_away = mapper.get_korean_name(pin_match.team_away)
        
        if not kor_home or not kor_away:
            print(f"[SKIP] Unknown mapping for {pin_match.team_home} vs {pin_match.team_away}")
            continue
            
        # Find matching game in Betman (Naive search)
        target_match = None
        for bet_match in betman_odds_list:
            if bet_match.team_home == kor_home and bet_match.team_away == kor_away:
                target_match = bet_match
                break
        
        if target_match:
            print(f"[MATCH] Found {pin_match.team_home} ({kor_home}) vs {pin_match.team_away} ({kor_away})")
            
            # Analyze
            opportunities = finder.analyze_match(pin_match, target_match)
            if opportunities:
                for opp in opportunities:
                    print(f"  !!! VALUE BET FOUND !!!")
                    print(f"  Type: {opp.bet_type} | EV: {opp.expected_value} | Kelly: {opp.kelly_pct*100}%")
                    print(f"  Details: {opp.dict()}")
                    value_bets.extend(opportunities)
        else:
            print(f"[MISS] No Betman match for {kor_home} vs {kor_away}")

    # 4. Final Report
    print(f"\n>>> Pipeline Complete. Found {len(value_bets)} value bets.")

if __name__ == "__main__":
    run_pipeline()
