from fastapi import APIRouter
import os
from typing import List
from app.schemas.odds import ValueBetOpportunity
from app.services.pinnacle_api import PinnacleService
from app.services.crawler_betman import BetmanCrawler
from app.services.team_mapper import TeamMapper
from app.core.value_bet import ValueBetFinder
from app.core.calculator import calculate_tax_free_limit
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.models.bets_db import ValuePickDB
from app.models.config_db import SystemConfigDB


router = APIRouter()

# Instantiate services once (Singleton-ish for now)
pin_service = PinnacleService()
betman_service = BetmanCrawler()
mapper = TeamMapper()
finder = ValueBetFinder(ev_threshold=1.05)

@router.get("/bets", response_model=List[ValueBetOpportunity])
async def get_positive_ev_bets(db: AsyncSession = Depends(get_db)):
    """
    Fetch odds, find value bets, save to DB, and return.
    """
    try:
        # 0. Get System Config
        config_result = await db.execute(select(SystemConfigDB))
        sys_config = config_result.scalars().first()
        
        if sys_config and sys_config.pinnacle_api_key:
            pin_service.set_api_key(sys_config.pinnacle_api_key)
        else:
            env_key = os.getenv("PINNACLE_API_KEY")
            if env_key:
                pin_service.set_api_key(env_key)
            
        # 1. Fetch & Analyze (Same logic as before)
        pin_odds = pin_service.fetch_odds()
        betman_odds = betman_service.fetch_odds()
        
        new_opportunities = []
        
        with open("debug_trace.log", "a") as f:
            f.write("Start Loop\n")
        
        for pin_match in pin_odds:
            # ... (mappings)
            kor_home = mapper.get_korean_name(pin_match.team_home)
            kor_away = mapper.get_korean_name(pin_match.team_away)
            
            if not kor_home: continue
            
            target = next((
                b for b in betman_odds 
                if b.team_home == kor_home
            ), None)
            
            if target:
                with open("debug_trace.log", "a") as f:
                    f.write(f"Target Found: {pin_match.team_home}\n")
                
                opps = finder.analyze_match(pin_match, target)
                for opp in opps:
                    with open("debug_trace.log", "a") as f:
                        f.write("Adding Pick\n")
                    # ... (create db_pick)
                    db_pick = ValuePickDB(
                        match_name=opp.match_name,
                        bet_type=opp.bet_type,
                        domestic_odds=opp.domestic_odds,
                        pinnacle_odds=opp.pinnacle_odds,
                        true_probability=opp.true_probability,
                        expected_value=opp.expected_value,
                        kelly_pct=opp.kelly_pct
                    )

                    
                    # Deduplication Check
                    # Check if the exact same bet was recently added
                    stmt = select(ValuePickDB).where(
                        ValuePickDB.match_name == opp.match_name,
                        ValuePickDB.bet_type == opp.bet_type
                    ).order_by(ValuePickDB.id.desc()).limit(1)
                    
                    existing_result = await db.execute(stmt)
                    existing = existing_result.scalars().first()
                    
                    is_duplicate = False
                    if existing:
                         # Compare odds to see if they changed
                         # If odds are same (float comparison with epsilon), it's a duplicate
                         if abs(existing.domestic_odds - opp.domestic_odds) < 0.001:
                             is_duplicate = True
                    
                    if not is_duplicate:
                        db.add(db_pick)
                        print(f"✅ Found Opportunity (New): {opp.match_name} EV={opp.expected_value}")
                        new_opportunities.append(opp)
                    else:
                        print(f"ℹ️ Duplicate skipped: {opp.match_name}")
        if new_opportunities:
            await db.commit()
    
        # Return all recent bets from DB (Last 50)
        result = await db.execute(select(ValuePickDB).order_by(ValuePickDB.id.desc()).limit(50))
        picks = result.scalars().all()
        
        # Convert DB models to Pydantic
        return [
            ValueBetOpportunity(
                match_name=p.match_name,
                bet_type=p.bet_type,
                domestic_odds=p.domestic_odds,
                true_probability=p.true_probability,
                pinnacle_odds=p.pinnacle_odds,
                expected_value=p.expected_value,
                expected_value=p.expected_value,
                kelly_pct=p.kelly_pct,
                max_tax_free_stake=calculate_tax_free_limit(p.domestic_odds),
                timestamp=str(p.created_at)
            ) for p in picks
        ]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e
