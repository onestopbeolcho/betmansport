from sqlalchemy import Column, Integer, String
from app.db.base import Base

class SystemConfigDB(Base):
    __tablename__ = 'system_config'

    id = Column(Integer, primary_key=True)
    pinnacle_api_key = Column(String, default="")
    betman_user_agent = Column(String, default="")
    scrape_interval_minutes = Column(Integer, default=10)
    
    # Singleton pattern helper (usually we ensure only row ID=1 exists)
