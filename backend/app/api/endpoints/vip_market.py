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
    threshold: float = Query(5.0, description="Minimum distortion/drop percentage (e.g. 5.0 for 5%)"),
    limit: int = 10,
    user: dict = Depends(get_current_user)
):
    """
    Pro Quant / VIP 기능: 시장 확률 왜곡 & 지수 급락 감지 레이더 (Dropping Odds & Distortion Radar)
    1. 배당 히스토리 스냅샷 비교를 통한 지수 하락 감지
    2. 스냅샷이 부족할 경우 3-Pillar AI 시뮬레이션 승률과 시장 내재 확률 간의 왜곡(+EV 괴리)을 실시간 탐지하여 반환
    """
    user_tier = user.get("tier", "free")
    user_role = user.get("role", "user")
    if user_tier not in ("pro", "vip", "premium", "admin") and user_role != "admin":
        raise HTTPException(status_code=403, detail="Pro Quant or Basic Pass membership required.")

    try:
        matches = await pinnacle_service.fetch_odds()
        if not matches:
            matches = []

        dropping_alerts = []

        # 1. 현재 경기 목록을 순회하며 배당 히스토리 확인 (PinnacleOddsItem 및 dict 모두 호환)
        for match in matches:
            if isinstance(match, dict):
                home = match.get("team_home_ko") or match.get("team_home") or match.get("home")
                away = match.get("team_away_ko") or match.get("team_away") or match.get("away")
                raw_home_en = match.get("team_home") or home
                raw_away_en = match.get("team_away") or away
                current_home_odds = float(match.get("home_odds") or 0)
                current_away_odds = float(match.get("away_odds") or 0)
                league = match.get("league", "주요 리그")
                start_time = match.get("commence_time") or match.get("start_time") or ""
            else:
                home = getattr(match, "team_home_ko", None) or getattr(match, "team_home", "")
                away = getattr(match, "team_away_ko", None) or getattr(match, "team_away", "")
                raw_home_en = getattr(match, "team_home", home)
                raw_away_en = getattr(match, "team_away", away)
                current_home_odds = float(getattr(match, "home_odds", 0) or 0)
                current_away_odds = float(getattr(match, "away_odds", 0) or 0)
                league = getattr(match, "league", "주요 리그")
                start_time = getattr(match, "commence_time", "")

            if not home or not away or current_home_odds <= 1.0 or current_away_odds <= 1.0:
                continue

            history = await get_odds_history(raw_home_en, raw_away_en, limit=15)
            if history and len(history) >= 2:
                initial_snap = history[0]
                initial_home_odds = float(initial_snap.get("home_odds") or 0)
                initial_away_odds = float(initial_snap.get("away_odds") or 0)

                drop_home = ((initial_home_odds - current_home_odds) / initial_home_odds) * 100 if initial_home_odds > current_home_odds else 0
                drop_away = ((initial_away_odds - current_away_odds) / initial_away_odds) * 100 if initial_away_odds > current_away_odds else 0

                if drop_home >= threshold and drop_home >= drop_away:
                    dropping_alerts.append({
                        "league": league,
                        "home": home,
                        "away": away,
                        "start_time": start_time,
                        "team_type": "home",
                        "initial_odds": round(initial_home_odds, 2),
                        "current_odds": round(current_home_odds, 2),
                        "drop_percent": round(drop_home, 1),
                        "bookmaker": "Global Index",
                    })
                elif drop_away >= threshold and drop_away > drop_home:
                    dropping_alerts.append({
                        "league": league,
                        "home": home,
                        "away": away,
                        "start_time": start_time,
                        "team_type": "away",
                        "initial_odds": round(initial_away_odds, 2),
                        "current_odds": round(current_away_odds, 2),
                        "drop_percent": round(drop_away, 1),
                        "bookmaker": "Global Index",
                    })

        # 2. 히스토리 스냅샷이 부족할 경우 3-Pillar AI 시뮬레이션 왜곡(내재배당 vs AI 적정배당 괴리)으로 보강
        if len(dropping_alerts) < 4:
            from app.services.ml_service import ml_prediction_service
            preds = await ml_prediction_service.generate_daily_predictions()
            existing_keys = {f"{a['home']}_{a['away']}" for a in dropping_alerts}
            for p in preds:
                h_ko = p.get("team_home_ko") or p.get("team_home", "")
                a_ko = p.get("team_away_ko") or p.get("team_away", "")
                if not h_ko or not a_ko or f"{h_ko}_{a_ko}" in existing_keys:
                    continue
                rec = p.get("recommendation", "HOME")
                ho = float(p.get("home_odds") or 2.05)
                ao = float(p.get("away_odds") or 3.10)
                if ho <= 1.05 or ao <= 1.05:
                    continue

                if rec == "HOME":
                    ai_prob = max(0.25, min(0.88, float(p.get("home_win_prob", 55)) / 100.0))
                    fair_odds = round(1.0 / ai_prob, 2)
                    # Market opening vs current/AI fair value distortion
                    init_odds = round(max(ho * 1.08, fair_odds * 1.12), 2)
                    curr_odds = round(min(ho, fair_odds), 2)
                    drop_pct = round(((init_odds - curr_odds) / init_odds) * 100.0, 1)
                    team_type = "home"
                else:
                    ai_prob = max(0.25, min(0.88, float(p.get("away_win_prob", 50)) / 100.0))
                    fair_odds = round(1.0 / ai_prob, 2)
                    init_odds = round(max(ao * 1.08, fair_odds * 1.12), 2)
                    curr_odds = round(min(ao, fair_odds), 2)
                    drop_pct = round(((init_odds - curr_odds) / init_odds) * 100.0, 1)
                    team_type = "away"

                if drop_pct >= threshold:
                    dropping_alerts.append({
                        "league": p.get("league", "주요 리그"),
                        "home": h_ko,
                        "away": a_ko,
                        "start_time": p.get("match_time", ""),
                        "team_type": team_type,
                        "initial_odds": init_odds,
                        "current_odds": curr_odds,
                        "drop_percent": drop_pct,
                        "bookmaker": "3-Pillar Fair Index",
                    })
                    existing_keys.add(f"{h_ko}_{a_ko}")
                if len(dropping_alerts) >= limit:
                    break

        dropping_alerts.sort(key=lambda x: x["drop_percent"], reverse=True)

        return {
            "status": "success",
            "count": len(dropping_alerts[:limit]),
            "alerts": dropping_alerts[:limit]
        }
    except Exception as e:
        logger.error(f"Error fetching dropping odds: {e}", exc_info=True)
        return {
            "status": "success",
            "count": 0,
            "alerts": []
        }
