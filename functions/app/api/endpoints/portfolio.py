from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app.models.user_db import add_portfolio_item, get_user_portfolio
from app.models.bets_db import save_betting_slip, get_user_betting_slips
from app.api.deps import get_current_user
from app.schemas.user import User
import json

router = APIRouter()

class PortfolioItemCreate(BaseModel):
    match_name: str
    selection: str
    odds: float
    stake: int

class PortfolioItemResponse(PortfolioItemCreate):
    id: str
    result: str
    profit: float
    created_at: datetime = None
    
    class Config:
        orm_mode = True

@router.post("/add", response_model=PortfolioItemResponse)
async def add_to_portfolio(item: PortfolioItemCreate, current_user: User = Depends(get_current_user)):
    # Logic: Add a bet to user's portfolio
    new_item_data = {
        "user_id": current_user.id,
        "match_name": item.match_name,
        "selection": item.selection,
        "odds": item.odds,
        "stake": item.stake,
        "result": "pending",
        "profit": 0.0
    }
    saved_item = await add_portfolio_item(new_item_data)
    return saved_item

@router.get("/my", response_model=List[PortfolioItemResponse])
async def get_my_portfolio(current_user: User = Depends(get_current_user)):
    return await get_user_portfolio(current_user.id)


# --- Betting Slip / Cart Features ---

class SlipItem(BaseModel):
    id: str
    match_name: str
    selection: str
    odds: float
    team_home: str
    team_away: str
    time: str

class SlipCreate(BaseModel):
    items: List[SlipItem]
    stake: int
    total_odds: float
    potential_return: int

class SlipResponse(SlipCreate):
    id: str
    status: str
    created_at: datetime = None
    
    class Config:
        orm_mode = True

@router.post("/slip/save", response_model=SlipResponse)
async def save_bet_slip(slip: SlipCreate, current_user: User = Depends(get_current_user)):
    # Serialize items to JSON string if needed, or store as array in Firestore
    # Firestore supports arrays/maps natively! No need to JSON dump unless we want string.
    # But previous model had `items` as string.
    # Let's verify what the frontend expects.
    # Frontend likely expects parsed JSON since `items: List[SlipItem]`.
    # Firestore can store `items` as a list of maps.
    
    items_list = [item.dict() for item in slip.items]
    
    slip_id = await save_betting_slip(
        user_id=current_user.id,
        items=items_list,
        total_odds=slip.total_odds,
        potential_return=slip.potential_return
    )
    
    return {
        "id": slip_id,
        "items": slip.items,
        "stake": slip.stake,
        "total_odds": slip.total_odds,
        "potential_return": slip.potential_return,
        "status": "PENDING",
        "created_at": datetime.utcnow()
    }

@router.get("/slips/my", response_model=List[SlipResponse])
async def get_my_slips(current_user: User = Depends(get_current_user)):
    slips = await get_user_betting_slips(current_user.id)
    # Firestore returns `items` as list (if we stored as list).
    # If we stored as list of dicts, it matches `List[SlipItem]`.
    return slips
