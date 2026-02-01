from pydantic import BaseModel
from typing import Optional

class OddsItem(BaseModel):
    provider: str  # 'Pinnacle', 'Betman'
    home_odds: float
    draw_odds: float
    away_odds: float
    team_home: str
    team_away: str
    match_time: Optional[str] = None
    sport: Optional[str] = "Soccer"
    league: Optional[str] = None

class ValueBetOpportunity(BaseModel):
    match_name: str
    bet_type: str  # 'Home', 'Draw', 'Away'
    domestic_odds: float
    true_probability: float
    pinnacle_odds: float
    expected_value: float  # EV
    kelly_pct: float
    timestamp: str
