"""
ScoreNix Proto API Endpoints (베트맨 프로토 승부식 AI 리포트 & B2B 판매점 A4 출력 & 적중 영수증 아카이브)
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from app.services.proto_round_service import (
    build_proto_round_report,
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


@router.get("/current-round")
async def get_current_proto_round(round_id: Optional[str] = Query(default=None)):
    """현재 발매 중인 베트맨 프로토 승부식 회차 전체 AI 공략 리포트 조회 (B2C 웹 & B2B A4 출력 공용)."""
    return await build_proto_round_report(round_id=round_id)


@router.get("/round/{round_id}")
async def get_proto_round_by_id(round_id: str):
    """특정 회차(round_id)의 프로토 승부식 AI 공략 리포트 조회 (/store/print-report/[round_id] 연동)."""
    return await build_proto_round_report(round_id=round_id)


@router.post("/match-entities")
async def resolve_betman_entities(req: EntityMatchRequest):
    """
    [Task 1] Gemini 1.5/2.5 Flash 기반 베트맨 단축 한글팀명 <-> 글로벌 Canonical Fixture 매칭 API.
    단일 betman_item 또는 복수 betman_items 입력을 모두 지원하며 100% Structured JSON으로 반환합니다.
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
    [Task 4] 마감된 최근 5회차 주력 조합 적중률 배너 및 실시간 적중 영수증 아카이브 조회 (/archive/history).
    """
    return await get_proto_archive_history()


@router.get("/marketing-receipt-json")
async def get_marketing_receipt_json():
    """
    [Task 4 - Marketing] 일일 적중 영수증 쇼츠 렌더링용 요약 JSON 생성.
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
