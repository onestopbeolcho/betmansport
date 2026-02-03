from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from datetime import datetime

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="free") # free, premium, admin
    subscription_expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    payments = relationship("PaymentDB", back_populates="user")
    portfolio = relationship("BettingPortfolioDB", back_populates="user")

class PaymentDB(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer, nullable=False)
    status = Column(String, default="pending") # pending, approved, rejected
    depositor_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserDB", back_populates="payments")

class BettingPortfolioDB(Base):
    __tablename__ = "betting_portfolio"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    match_name = Column(String, nullable=False)
    selection = Column(String, nullable=False)
    odds = Column(Float, nullable=False)
    stake = Column(Integer, nullable=False)
    result = Column(String, default="pending") # pending, win, loss, void
    profit = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("UserDB", back_populates="portfolio")
