from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.models.config_db import SystemConfigDB
from pydantic import BaseModel

router = APIRouter()

# Pydantic Schema for Response/Request
class SystemConfigSchema(BaseModel):
    pinnacle_api_key: str
    betman_user_agent: str
    scrape_interval_minutes: int
    class Config:
        orm_mode = True

@router.get("/config", response_model=SystemConfigSchema)
async def get_system_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfigDB))
    config = result.scalars().first()
    if not config:
        # Create default if missing
        config = SystemConfigDB()
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config

@router.post("/config", response_model=SystemConfigSchema)
async def update_system_config(new_config: SystemConfigSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemConfigDB))
    config = result.scalars().first()
    if not config:
        config = SystemConfigDB()
        db.add(config)
    
    config.pinnacle_api_key = new_config.pinnacle_api_key
    config.betman_user_agent = new_config.betman_user_agent
    config.scrape_interval_minutes = new_config.scrape_interval_minutes
    
    await db.commit()
    await db.refresh(config)
    return config
