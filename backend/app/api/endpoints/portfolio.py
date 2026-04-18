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


from app.services.pinnacle_api import pinnacle_service
import logging

logger = logging.getLogger(__name__)

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
    # 1. Fetch latest odds from backend cache
    latest_odds = await pinnacle_service.fetch_odds()
    
    # 2. Create map for fast lookup
    odds_map = {}
    for o in latest_odds:
        key_en = f"{o.team_home}_{o.team_away}".lower()
        key_ko = f"{o.team_home_ko}_{o.team_away_ko}".lower()
        odds_map[key_en] = o
        odds_map[key_ko] = o
        
    updated_items = []
    calculated_total_odds = 1.0
    
    # 3. Verify against backend odds
    for item in slip.items:
        key = f"{item.team_home}_{item.team_away}".lower().strip()
        latest_item = odds_map.get(key)
        
        server_odds = item.odds # Default to existing if not found (or match started)
        if latest_item:
            sel = item.selection.strip().capitalize()
            if sel in ["Home", "홈"]:
                server_odds = latest_item.home_odds
            elif sel in ["Draw", "무", "무승부"]:
                server_odds = latest_item.draw_odds
            elif sel in ["Away", "원정"]:
                server_odds = latest_item.away_odds
        
        # Rule: If server odds exist and difference is significant (>= 0.1), reject slip
        if server_odds > 0 and abs(server_odds - item.odds) >= 0.1:
            logger.warning(f"Rejecting slip for {current_user.id}: Odds mismatch on {item.match_name}. User={item.odds}, Server={server_odds}")
            raise HTTPException(
                status_code=400,
                detail=f"[{item.team_home} vs {item.team_away}] 배당률이 변동되었습니다 (현재 {server_odds}). 화면을 새로고침해주세요."
            )
            
        # Update the item with verified odds
        item.odds = server_odds
        updated_items.append(item.dict())
        calculated_total_odds *= server_odds
    
    calculated_potential_return = int(slip.stake * calculated_total_odds)
    
    slip_id = await save_betting_slip(
        user_id=current_user.id,
        items=updated_items,
        total_odds=round(calculated_total_odds, 2),
        potential_return=calculated_potential_return
    )
    
    return {
        "id": slip_id,
        "items": updated_items,
        "stake": slip.stake,
        "total_odds": round(calculated_total_odds, 2),
        "potential_return": calculated_potential_return,
        "status": "PENDING",
        "created_at": datetime.utcnow()
    }

@router.get("/slips/my", response_model=List[SlipResponse])
async def get_my_slips(current_user: User = Depends(get_current_user)):
    slips = await get_user_betting_slips(current_user.id)
    return slips
