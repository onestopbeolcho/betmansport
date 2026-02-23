from pydantic import BaseModel
from typing import Optional

class OddsItem(BaseModel):
    provider: str  # 'Pinnacle', 'Betman'
    home_odds: float
    draw_odds: float
    away_odds: float
    team_home: str
    team_away: str
    team_home_ko: Optional[str] = None
    team_away_ko: Optional[str] = None
    match_time: Optional[str] = None
    sport: Optional[str] = None
    league: Optional[str] = None

class ValueBetOpportunity(BaseModel):
    id: Optional[int] = None
    match_name: str
    bet_type: str  # 'Home', 'Draw', 'Away'
    domestic_odds: float
    true_probability: float
    pinnacle_odds: float
    expected_value: float  # EV
    kelly_pct: float
    max_tax_free_stake: Optional[int] = None
    timestamp: str

class MatchBetSummary(BaseModel):
    """One row per match — contains all 3 odds + best bet info."""
    match_name: str
    league: str = ""
    match_time: str = ""
    # Domestic (Betman) odds
    home_odds: float = 0.0
    draw_odds: float = 0.0
    away_odds: float = 0.0
    # Pinnacle odds
    pin_home_odds: float = 0.0
    pin_draw_odds: float = 0.0
    pin_away_odds: float = 0.0
    # Best bet recommendation
    best_bet_type: str = ""  # 'Home', 'Draw', 'Away'
    best_ev: float = 0.0
    best_kelly: float = 0.0
    has_betman: bool = False  # True if matched with Betman data


class OddsHistoryItem(BaseModel):
    provider: str
    team_home: str
    team_away: str
    home_odds: float
    draw_odds: float
    away_odds: float
    timestamp: str

    class Config:
        orm_mode = True
