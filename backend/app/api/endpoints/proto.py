"""
ScoreNix Betman Multi-Game & Proto AI Report API Endpoints
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from app.services.proto_round_service import (
    build_proto_round_report,
    get_betman_games_catalog,
    get_proto_archive_history,
    match_betman_entities_with_gemini,
)

router = APIRouter()


class BetmanItemPayload(BaseModel):
    game_no: int = 45
    league: str = "EPL"
    home: str = "맨체스C"
    away: str = "울버햄프"
    cutoff_time: str = "2026-10-31 22:50"


class CanonicalFixturePayload(BaseModel):
    fixture_id: str
    home: str
    away: str
    kickoff: Optional[str] = ""


class EntityMatchRequest(BaseModel):
    betman_item: Optional[BetmanItemPayload] = None
    betman_items: Optional[List[BetmanItemPayload]] = None
    canonical_fixtures: List[CanonicalFixturePayload]


@router.get("/games")
async def get_betman_games_list():
    """베트맨 공식 사이트에서 현재 운영 중인 전체 게임(승무패, 승5패, 스페셜N 더블/트리플, 매치, 프로토 승부식 등) 목록 조회."""
    return await get_betman_games_catalog()


@router.get("/game/{gm_id}/{gm_ts}")
async def get_betman_game_report(gm_id: str, gm_ts: str):
    """특정 베트맨 게임(예: G011/260065 축구토토 승무패 65회차, G055/260098 스페셜N 더블 98회차)의 경기 목록 및 AI 리포트 조회."""
    return await build_proto_round_report(round_id=f"{gm_id}_{gm_ts}")


@router.get("/current-round")
async def get_current_proto_round(round_id: Optional[str] = Query(default=None)):
    """현재 선택된 베트맨 게임/회차의 전체 AI 분석 리포트 조회."""
    return await build_proto_round_report(round_id=round_id)


@router.get("/round/{round_id}")
async def get_proto_round_by_id(round_id: str):
    """특정 회차/게임키(예: G011_260065, G027_260031, G055_260098, 260129)의 AI 리포트 조회."""
    return await build_proto_round_report(round_id=round_id)


@router.post("/match-entities")
async def resolve_betman_entities(req: EntityMatchRequest):
    """
    [Task 1] Gemini 2.5 Flash 기반 베트맨 단축 한글팀명 <-> 글로벌 Canonical Fixture 매칭 API.
    """
    items_to_match: List[Dict[str, Any]] = []
    if req.betman_item:
        items_to_match.append(req.betman_item.model_dump())
    if req.betman_items:
        items_to_match.extend([it.model_dump() for it in req.betman_items])

    canonical_list = [cf.model_dump() for cf in req.canonical_fixtures]
    matched = await match_betman_entities_with_gemini(items_to_match, canonical_list)

    if req.betman_item and not req.betman_items and len(matched) == 1:
        return matched[0]
    return {"matched_count": len(matched), "results": matched}


@router.get("/archive")
async def get_proto_archive():
    """
    외부 마케팅 및 백테스트 검증 통계 요약 조회.
    """
    return await get_proto_archive_history()


@router.get("/marketing-receipt-json")
async def get_marketing_receipt_json():
    """
    [SNS / YouTube Shorts 마케팅 전용] 일일 적중 영수증 쇼츠 렌더링용 요약 JSON 생성.
    """
    archive = await get_proto_archive_history()
    current = await build_proto_round_report()
    latest_hit = next((r for r in archive["receipts"] if r["status"] == "HIT"), archive["receipts"][0])
    return {
        "schema_version": "scorenix_receipt_shorts_v1",
        "banner": archive["banner"],
        "featured_receipt": latest_hit,
        "next_round": {
            "round_id": current["round_id"],
            "round_title": current["round_title"],
            "main_2folder_odds": current["section_a_combos"]["main_2folder"]["total_odds"],
            "main_2folder_prob": current["section_a_combos"]["main_2folder"]["hit_probability_pct"],
            "killer_picks_count": current["killer_picks_count"],
        },
    }
