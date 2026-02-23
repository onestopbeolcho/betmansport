"""
AI 분석 API — Gemini LLM 기반 경기 분석
- 팀 이름 매칭으로 경기 식별
- Pinnacle + Betman 배당 데이터를 Gemini에 전달
- API 키 미설정 시 규칙 기반 분석 폴백
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.pinnacle_api import pinnacle_service
from app.models.betman_db import get_betman_matches
from app.services.team_mapper import TeamMapper
from app.services.gemini_service import analyze_match
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

_mapper = TeamMapper()


class AnalysisRequest(BaseModel):
    query: str


class AnalysisResponse(BaseModel):
    response: str
    match_found: bool
    match_name: Optional[str] = None


def _normalize(name: str) -> str:
    return name.strip().lower().replace(" ", "").replace("FC", "").replace("fc", "")


@router.post("/ask", response_model=AnalysisResponse)
async def ask_analyst(request: AnalysisRequest):
    """
    경기 분석 AI 엔드포인트.
    1. 팀 이름으로 경기 검색
    2. Pinnacle + Betman 배당 데이터 수집
    3. Gemini AI로 분석 리포트 생성 (폴백: 규칙 기반)
    """
    query = request.query.strip()
    query_lower = query.lower()

    # Handle greetings
    if any(w in query_lower for w in ['hello', 'hi', '안녕', '도와줘', 'help']):
        return AnalysisResponse(
            response="안녕하세요! 저는 스포츠 배당 분석 AI입니다. 분석을 원하시는 **팀 이름**이나 **경기**를 말씀해 주세요.\n\n예시: `맨체스터 시티 분석해줘`, `레알 마드리드 승률 어때?`",
            match_found=False,
        )

    # 1. Fetch Pinnacle data
    pinnacle_data = await pinnacle_service.fetch_odds()
    if not pinnacle_data:
        return AnalysisResponse(
            response="현재 배당 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.",
            match_found=False,
        )

    # 2. Find matching match from Pinnacle
    selected = None
    for match in pinnacle_data:
        home = match.team_home.lower()
        away = match.team_away.lower()
        home_ko = match.team_home_ko.lower() if match.team_home_ko else ""
        away_ko = match.team_away_ko.lower() if match.team_away_ko else ""

        if any(t and t in query_lower for t in [home, away, home_ko, away_ko] if len(t) > 1):
            selected = match
            break

    if not selected:
        # Try partial matching
        for match in pinnacle_data:
            names = [
                match.team_home.lower(),
                match.team_away.lower(),
                (match.team_home_ko or "").lower(),
                (match.team_away_ko or "").lower(),
            ]
            for name in names:
                # Check partial: at least 3 chars of team name in query
                words = [w for w in name.split() if len(w) >= 3]
                if any(w in query_lower for w in words):
                    selected = match
                    break
            if selected:
                break

    if not selected:
        return AnalysisResponse(
            response="현재 분석 가능한 경기 목록에서 해당 팀을 찾을 수 없습니다.\n\n현재 제공되는 경기를 **배당분석** 또는 **전체경기** 페이지에서 확인해주세요.",
            match_found=False,
        )

    # 3. Enrich with Betman data
    betman_home = None
    betman_draw = None
    betman_away = None

    try:
        betman_matches = get_betman_matches()
        for bm in betman_matches:
            bh = bm.get("team_home", "")
            ba = bm.get("team_away", "")
            if _mapper.match_team_pair(bh, ba, selected.team_home, selected.team_away):
                betman_home = float(bm.get("home_odds", 0))
                betman_draw = float(bm.get("draw_odds", 0))
                betman_away = float(bm.get("away_odds", 0))
                break
    except Exception as e:
        logger.warning(f"Betman enrichment failed: {e}")

    # 4. Build match_data dict
    match_data = {
        "team_home": selected.team_home,
        "team_away": selected.team_away,
        "team_home_ko": selected.team_home_ko or selected.team_home,
        "team_away_ko": selected.team_away_ko or selected.team_away,
        "league": selected.league or "",
        "home_odds": selected.home_odds,
        "draw_odds": selected.draw_odds,
        "away_odds": selected.away_odds,
    }
    if betman_home and betman_away:
        match_data["betman_home_odds"] = betman_home
        match_data["betman_draw_odds"] = betman_draw
        match_data["betman_away_odds"] = betman_away

    # 5. Call Gemini (or fallback)
    analysis_text = await analyze_match(match_data, query)

    home_name = selected.team_home_ko or selected.team_home
    away_name = selected.team_away_ko or selected.team_away

    return AnalysisResponse(
        response=analysis_text,
        match_found=True,
        match_name=f"{home_name} vs {away_name}",
    )
