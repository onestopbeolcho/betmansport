import sys
import os
import asyncio

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.services.factor_scorer import calculate_factor_scores

def test_factor_scorer():
    print("Testing factor scorer...")
    test_match = {
        "team_home": "Arsenal",
        "team_away": "Chelsea",
        "home_odds": 1.80,
        "draw_odds": 3.50,
        "away_odds": 4.20,
        "standings": {
            "home": {"rank": 2, "form": "WWDLW", "goals_for": 25, "goals_against": 10},
            "away": {"rank": 8, "form": "LDWWL", "goals_for": 18, "goals_against": 15}
        },
        "h2h": {
            "total_matches": 10,
            "team_a_wins": 5,
            "team_b_wins": 2
        },
        "injuries": {
            "home": ["Player A"],
            "away": ["Player B", "Player C"]
        }
    }
    
    result = calculate_factor_scores(test_match)
    print("Factor Scorer Result:")
    print(result)
    assert "total_score" in result
    assert "details" in result
    details = result["details"]
    assert "power_rating" in details
    assert "form_momentum" in details
    assert "h2h_dominance" in details
    assert "injury_fatigue" in details
    assert "coach_factor" in details
    assert "squad_quality" in details
    assert "market_implied" in details
    print("Factor Scorer test PASSED!")

async def test_api_endpoints():
    print("Testing API endpoints compilation and routes...")
    from app.main import app
    print("App compiled successfully!")
    
    # Test bets mock prediction / EV gap
    from app.api.endpoints.odds import get_all_bets
    bets = await get_all_bets()
    print(f"get_all_bets returned {len(bets)} matches")
    if len(bets) > 0:
        print("First bet item:", bets[0])

if __name__ == "__main__":
    test_factor_scorer()
    asyncio.run(test_api_endpoints())
