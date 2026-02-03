from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.models.user_db import BettingPortfolioDB, UserDB
from app.api.endpoints.payments import get_current_user # Reuse dependency

router = APIRouter()

class PortfolioItemCreate(BaseModel):
    match_name: str
    selection: str
    odds: float
    stake: int

class PortfolioItemResponse(PortfolioItemCreate):
    id: int
    result: str
    profit: float
    created_at: datetime
    
    class Config:
        orm_mode = True

@router.post("/add", response_model=PortfolioItemResponse)
def add_to_portfolio(item: PortfolioItemCreate, current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    # Logic: Add a bet to user's portfolio
    new_item = BettingPortfolioDB(
        user_id=current_user.id,
        match_name=item.match_name,
        selection=item.selection,
        odds=item.odds,
        stake=item.stake,
        result="pending",
        profit=0.0
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.get("/my", response_model=List[PortfolioItemResponse])
def get_my_portfolio(current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(BettingPortfolioDB).filter(BettingPortfolioDB.user_id == current_user.id).order_by(BettingPortfolioDB.created_at.desc()).all()
