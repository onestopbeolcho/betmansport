from fastapi import APIRouter, Depends, HTTPException, Query
from app.db.firestore import get_firestore_db
from app.services.pinnacle_api import pinnacle_service
from app.models.bets_db import get_odds_history
from app.api.endpoints.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/dropping-odds")
async def get_dropping_odds(
    threshold: float = Query(10.0, description="Minimum drop percentage (e.g. 10.0 for 10%)"),
    limit: int = 10,
    user: dict = Depends(get_current_user)
):
    """
    VIP 독점 기능: 배당 급락 감지 (Dropping Odds)
    현재 라이브/예정 경기들의 배당 변동 이력을 조회하여, 
    최초 배당 대비 현재 배당이 `threshold`% 이상 하락한 항목을 찾아 반환.
    스마트 머니 유입 감지 등에 사용됨.
    """
    if user.get("tier") != "vip":
        raise HTTPException(status_code=403, detail="VIP members only. Please upgrade your plan.")

    try:
        matches = await pinnacle_service.fetch_odds()
        if not matches:
            matches = []

        dropping_alerts = []

        # 현재 경기 목록을 순회하며 배당 히스토리를 확인
        for match in matches:
            home = match.get("home")
            away = match.get("away")
            current_home_odds = match.get("home_odds", 0)
            current_away_odds = match.get("away_odds", 0)
            
            if not home or not away or not current_home_odds or not current_away_odds:
                continue
                
            history = await get_odds_history(home, away, limit=20)
            if not history or len(history) < 2:
                continue
                
            # 최초 배당 (가장 오래된 기록)
            initial_snap = history[-1] # oldest is at the end? wait, history is sorted by DESCENDING and reversed in get_odds_history, so history[0] is oldest
            initial_snap = history[0] 
            
            initial_home_odds = initial_snap.get("home_odds", 0)
            initial_away_odds = initial_snap.get("away_odds", 0)
            
            drop_home = 0
            drop_away = 0
            
            if initial_home_odds > 1.0 and current_home_odds < initial_home_odds:
                drop_home = ((initial_home_odds - current_home_odds) / initial_home_odds) * 100
                
            if initial_away_odds > 1.0 and current_away_odds < initial_away_odds:
                drop_away = ((initial_away_odds - current_away_odds) / initial_away_odds) * 100

            dropped_team = None
            drop_percent = 0
            initial_odds = 0
            current_odds = 0

            # 더 많이 떨어진 쪽을 기준으로 알림 생성
            if drop_home >= threshold and drop_home > drop_away:
                dropped_team = "home"
                drop_percent = drop_home
                initial_odds = initial_home_odds
                current_odds = current_home_odds
            elif drop_away >= threshold and drop_away > drop_home:
                dropped_team = "away"
                drop_percent = drop_away
                initial_odds = initial_away_odds
                current_odds = current_away_odds

            if dropped_team:
                dropping_alerts.append({
                    "league": match.get("league"),
                    "home": home,
                    "away": away,
                    "start_time": match.get("start_time"),
                    "team_type": dropped_team,
                    "initial_odds": round(initial_odds, 2),
                    "current_odds": round(current_odds, 2),
                    "drop_percent": round(drop_percent, 1),
                    "bookmaker": "Pinnacle"
                })

        # 가장 많이 하락한 순서로 정렬
        dropping_alerts.sort(key=lambda x: x["drop_percent"], reverse=True)
        
        return {
            "status": "success",
            "count": len(dropping_alerts[:limit]),
            "alerts": dropping_alerts[:limit]
        }
    except Exception as e:
        logger.error(f"Error fetching dropping odds: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate dropping odds")
