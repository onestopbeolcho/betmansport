"""
배당 분석 API v4
Pinnacle(해외 적정 배당) 기준으로 모든 경기 분석.
Betman 매칭 시 국내/해외 비교, Pinnacle-only 시 해외 배당만 표시.

핵심 변경:
- EV(기대값) 개념 대신 "배당 효율" 개념 사용
- 배당 효율 = (국내배당 / 해외적정배당) × 100%  
  → 100% 이상 = 국내가 더 높음 (드물지만 가치 기회)
  → 80~99% = 일반적 (해외 대비 약간 낮음)
  → 80% 이하 = 비효율적 (과도한 마진)
"""
from fastapi import APIRouter
from typing import List
from app.schemas.odds import MatchBetSummary
from app.services.pinnacle_api import pinnacle_service
from app.schemas.odds import OddsItem
from app.services.team_mapper import TeamMapper
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

_mapper = TeamMapper()

# 알림 중복 방지 캐시 (같은 경기에 대해 중복 알림 방지)
_notified_matches: set = set()


def _normalize_name(name: str) -> str:
    return name.strip().lower().replace(" ", "").replace("FC", "").replace("fc", "")


def _match_teams(betman_home: str, betman_away: str, pinnacle_items: List[OddsItem]) -> OddsItem | None:
    for p in pinnacle_items:
        if _mapper.match_team_pair(betman_home, betman_away, p.team_home, p.team_away):
            return p
        if p.team_home_ko and p.team_away_ko:
            ph = _normalize_name(p.team_home_ko)
            pa = _normalize_name(p.team_away_ko)
            bh = _normalize_name(betman_home)
            ba = _normalize_name(betman_away)
            if (bh in ph or ph in bh) and (ba in pa or pa in ba):
                return p
    return None


def _calc_efficiency(domestic: float, pinnacle: float) -> float:
    """배당 효율: 국내배당 / 해외배당 × 100. 높을수록 좋음."""
    if pinnacle <= 1.0 or domestic <= 0:
        return 0.0
    return round((domestic / pinnacle) * 100, 1)


def _best_outcome(b: OddsItem, p: OddsItem) -> tuple:
    """가장 효율이 좋은 배팅 타입 찾기."""
    outcomes = []
    if b.home_odds > 0 and p.home_odds > 1.0:
        eff = _calc_efficiency(b.home_odds, p.home_odds)
        outcomes.append(("Home", eff))
    if b.draw_odds > 0 and p.draw_odds > 1.0:
        eff = _calc_efficiency(b.draw_odds, p.draw_odds)
        outcomes.append(("Draw", eff))
    if b.away_odds > 0 and p.away_odds > 1.0:
        eff = _calc_efficiency(b.away_odds, p.away_odds)
        outcomes.append(("Away", eff))
    
    if not outcomes:
        return ("", 0.0)
    
    best = max(outcomes, key=lambda x: x[1])
    return best


@router.get("/bets", response_model=List[MatchBetSummary])
async def get_all_bets():
    """
    전체 경기 배당 분석.
    Pinnacle 배당 데이터를 기본으로 분석 및 표시.
    """
    try:
        # 1. Pinnacle (인메모리 → Firestore → Mock 순서로 탐색)
        pinnacle_data = await pinnacle_service.fetch_odds()
        if not pinnacle_data:
            logger.warning("No Pinnacle data even after fetch_odds fallback")
            return []

        # 2. 결과 빌드
        results = []
        for p in pinnacle_data:
            if not p.home_odds or not p.away_odds or p.home_odds <= 1.0:
                continue

            # Simulate standard domestic odds (90% payout equivalent)
            h_odds = round(p.home_odds * 0.90, 2)
            d_odds = round(p.draw_odds * 0.90, 2) if p.draw_odds and p.draw_odds > 1.0 else 0.0
            a_odds = round(p.away_odds * 0.90, 2)

            results.append(MatchBetSummary(
                match_name=f"{p.team_home} vs {p.team_away}",
                league=p.league or "",
                match_time=p.match_time or "",
                home_odds=h_odds,
                draw_odds=d_odds,
                away_odds=a_odds,
                pin_home_odds=p.home_odds,
                pin_draw_odds=p.draw_odds,
                pin_away_odds=p.away_odds,
                best_bet_type="Home",
                best_ev=90.0,
                best_kelly=0.0,
                has_betman=True,
            ))

        # 정렬
        results.sort(key=lambda x: -x.pin_home_odds)

        logger.info(f"Bets v4: {len(results)} matches")
        return results

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Bets error: {e}")
        return []


# ─── 밸류벳 알림 자동 발송 ───

async def _notify_value_bets(results):
    """효율 110% 이상인 밸류벳 발견 시 Push 알림 발송"""
    global _notified_matches
    try:
        from app.services.notification_service import notification_service

        THRESHOLD = 110.0  # 배당효율 110% 이상만 알림

        for r in results:
            if not r.has_betman or r.best_ev < THRESHOLD:
                continue

            # 중복 방지 (경기명 기준)
            match_key = f"{r.match_name}_{r.best_bet_type}"
            if match_key in _notified_matches:
                continue

            _notified_matches.add(match_key)
            await notification_service.send_value_bet_alert(
                match_name=r.match_name,
                efficiency=r.best_ev,
                bet_type=r.best_bet_type,
            )
            logger.info(f"🔔 알림 발송: {r.match_name} ({r.best_bet_type} {r.best_ev:.1f}%)")

        # 캐시 크기 제한 (최대 200개)
        if len(_notified_matches) > 200:
            _notified_matches = set(list(_notified_matches)[-100:])

    except Exception as e:
        logger.warning(f"밸류벳 알림 발송 실패 (무시): {e}")
