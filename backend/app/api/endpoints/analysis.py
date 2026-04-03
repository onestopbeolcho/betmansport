"""
AI 분석 API — Gemini LLM 기반 경기 분석
- 팀 이름 매칭으로 경기 식별
- 일반 질의 처리 (오늘 경기, AI 추천, 경기 목록 등)
- Pinnacle + Betman 배당 데이터를 Gemini에 전달
- ML 예측 엔진 연동
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

# General query keywords
GENERAL_KEYWORDS = [
    "오늘", "경기", "목록", "리스트", "전체", "몇경기", "몇 경기",
    "추천", "분석", "ai", "예측", "어떤", "뭐", "알려", "보여",
    "pick", "top", "best", "today", "match", "list",
]

GREETING_KEYWORDS = ['hello', 'hi', '안녕', '도와줘', 'help', '사용법', '어떻게']


class AnalysisRequest(BaseModel):
    query: str


class AnalysisResponse(BaseModel):
    response: str
    match_found: bool
    match_name: Optional[str] = None


def _normalize(name: str) -> str:
    return name.strip().lower().replace(" ", "").replace("FC", "").replace("fc", "")


def _is_general_query(query_lower: str) -> bool:
    """Check if the query is a general question (not team-specific)."""
    # Count how many general keywords match
    matches = sum(1 for kw in GENERAL_KEYWORDS if kw in query_lower)
    return matches >= 1


def _build_match_list_response(matches) -> str:
    """Build a formatted response listing available matches with AI predictions."""
    if not matches:
        return (
            "현재 분석 가능한 경기가 없습니다.\n\n"
            "⏰ **경기 데이터 업데이트 시간**\n"
            "• 유럽 리그: 매일 오후 6시~자정 (KST)\n"
            "• NBA/NHL: 매일 오전 7시~오후 2시 (KST)\n"
            "• MLB: 시즌 중 오전 7시~오후 1시 (KST)\n\n"
            "경기 시작 2~3시간 전부터 배당 데이터가 제공됩니다.\n"
            "**배당분석** 페이지에서 최신 경기를 확인해보세요!"
        )

    lines = [f"📊 **현재 분석 가능한 경기 ({len(matches)}경기)**\n"]

    # Group by league
    by_league = {}
    for m in matches:
        league = getattr(m, "league", None) or "기타"
        if league not in by_league:
            by_league[league] = []
        by_league[league].append(m)

    league_emojis = {
        "EPL": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "La Liga": "🇪🇸", "Bundesliga": "🇩🇪",
        "Serie A": "🇮🇹", "Ligue 1": "🇫🇷", "UEFA Champions League": "🏆",
        "NBA": "🏀", "NHL": "🏒", "MLB": "⚾",
    }

    for league, league_matches in by_league.items():
        emoji = "⚽"
        for key, val in league_emojis.items():
            if key.lower() in league.lower():
                emoji = val
                break
        lines.append(f"\n{emoji} **{league}**")
        for i, m in enumerate(league_matches, 1):
            home = getattr(m, "team_home_ko", None) or m.team_home
            away = getattr(m, "team_away_ko", None) or m.team_away
            time_str = ""
            if hasattr(m, "match_time") and m.match_time:
                time_str = f" ({m.match_time})"
            odds_str = ""
            if hasattr(m, "home_odds") and m.home_odds:
                odds_str = f"  [{m.home_odds:.2f} / {m.draw_odds:.2f} / {m.away_odds:.2f}]"
            lines.append(f"  {i}. {home} vs {away}{time_str}{odds_str}")

    lines.append("\n---")
    lines.append("💡 **사용법**: 팀 이름을 입력하면 상세 AI 분석을 받을 수 있어요!")
    lines.append('예: "맨시티 분석해줘", "아스널 승률", "레알 마드리드"')

    return "\n".join(lines)


@router.post("/ask", response_model=AnalysisResponse)
async def ask_analyst(request: AnalysisRequest):
    """
    경기 분석 AI 엔드포인트.
    1. 인사/도움말 처리
    2. 일반 질의 (경기 목록, 추천 등) 처리
    3. 팀 이름으로 경기 검색 → Gemini AI 분석
    """
    query = request.query.strip()
    query_lower = query.lower()

    # ── Handle greetings ──────────────────────
    if any(w in query_lower for w in GREETING_KEYWORDS):
        return AnalysisResponse(
            response=(
                "안녕하세요! 저는 **ScoreNix AI 분석 엔진**입니다. 🤖\n\n"
                "**사용 방법:**\n"
                '• 팀 이름 입력: "맨시티 분석해줘", "아스널 승률"\n'
                '• 경기 목록: "오늘 경기", "분석 가능한 경기"\n'
                '• AI 추천: "추천 경기", "AI 분석"\n\n'
                "8,960+ 경기를 학습한 LightGBM 엔진이 분석해드립니다!"
            ),
            match_found=False,
        )

    # ── Fetch match data ──────────────────────
    pinnacle_data = await pinnacle_service.fetch_odds()

    # ── Handle general queries ────────────────
    if _is_general_query(query_lower):
        response_text = _build_match_list_response(pinnacle_data)
        return AnalysisResponse(
            response=response_text,
            match_found=bool(pinnacle_data),
            match_name=f"{len(pinnacle_data)}경기 목록" if pinnacle_data else None,
        )

    # ── Team-specific analysis ────────────────
    if not pinnacle_data:
        return AnalysisResponse(
            response=(
                "현재 배당 데이터를 불러올 수 없습니다.\n\n"
                "⏰ 경기 데이터는 주로 경기 시작 2~3시간 전부터 업데이트됩니다.\n"
                "유럽 축구는 저녁 6시~자정, NBA/NHL은 오전 7시~오후 2시 (KST)에 "
                "데이터가 제공됩니다.\n\n"
                '다른 질문이 있으시면 "오늘 경기" 또는 "도와줘"를 입력해보세요!'
            ),
            match_found=False,
        )

    # Find matching match from Pinnacle (exact)
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
                words = [w for w in name.split() if len(w) >= 3]
                if any(w in query_lower for w in words):
                    selected = match
                    break
            if selected:
                break

    if not selected:
        # Show available matches as fallback
        available = _build_match_list_response(pinnacle_data)
        return AnalysisResponse(
            response=(
                f"**'{query}'**에 해당하는 팀을 찾지 못했습니다.\n\n"
                f"{available}"
            ),
            match_found=False,
        )

    # ── Enrich with Betman data ───────────────
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

    # ── Build match_data dict ─────────────────
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

    # ── Call Gemini (or fallback) ─────────────
    analysis_text = await analyze_match(match_data, query)

    home_name = selected.team_home_ko or selected.team_home
    away_name = selected.team_away_ko or selected.team_away

    return AnalysisResponse(
        response=analysis_text,
        match_found=True,
        match_name=f"{home_name} vs {away_name}",
    )
