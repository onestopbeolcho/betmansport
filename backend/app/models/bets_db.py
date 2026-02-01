from sqlalchemy import Column, Integer, String, Float, DateTime
from app.db.base import Base
import datetime

class ValuePickDB(Base):
    """
    Stores identified value bets.
    """
    __tablename__ = 'value_picks'

    id = Column(Integer, primary_key=True, index=True)
    match_name = Column(String, index=True)
    bet_type = Column(String)  # Home, Draw, Away
    domestic_odds = Column(Float)
    pinnacle_odds = Column(Float)
    true_probability = Column(Float)
    expected_value = Column(Float)
    kelly_pct = Column(Float)
    result = Column(String, default="PENDING")  # PENDING, WON, LOST
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class OddsHistoryDB(Base):
    """
    Raw odds history for analytics.
    """
    __tablename__ = 'odds_history'

    id = Column(Integer, primary_key=True)
    provider = Column(String) # Pinnacle, Betman
    team_home = Column(String)
    team_away = Column(String)
    home_odds = Column(Float)
    draw_odds = Column(Float)
    away_odds = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
