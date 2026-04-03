"""
Backtest Insights API — 과거 데이터 기반 AI 성과 분석 엔드포인트.
백테스트 결과를 프론트엔드에 제공하여 "검증된 분석 근거" 표시.
"""
from fastapi import APIRouter, Query
from typing import Optional
import logging

from app.services.backtest_engine import backtest_engine

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/insights")
async def get_backtest_insights(
    days: int = Query(90, ge=7, le=365, description="분석 기간 (일)")
):
    """
    전체 백테스트 인사이트 통합 조회.
    프론트엔드 AI 성과 대시보드에서 사용.
    """
    try:
        insights = await backtest_engine.get_full_insights(days=days)
        return {
            "status": "ok",
            "period_days": days,
            "insights": insights,
        }
    except Exception as e:
        logger.error(f"Backtest insights error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "insights": None,
        }


@router.get("/accuracy/league")
async def get_league_accuracy(
    days: int = Query(90, ge=7, le=365)
):
    """리그별 AI 적중률."""
    data = await backtest_engine.get_accuracy_by_league(days)
    return {"status": "ok", "data": data}


@router.get("/accuracy/odds-range")
async def get_odds_range_accuracy(
    days: int = Query(90, ge=7, le=365)
):
    """배당 구간별 AI 적중률."""
    data = await backtest_engine.get_accuracy_by_odds_range(days)
    return {"status": "ok", "data": data}


@router.get("/accuracy/confidence")
async def get_confidence_accuracy(
    days: int = Query(90, ge=7, le=365)
):
    """신뢰도 구간별 실제 적중률."""
    data = await backtest_engine.get_accuracy_by_confidence(days)
    return {"status": "ok", "data": data}


@router.get("/accuracy/trend")
async def get_accuracy_trend(
    days: int = Query(90, ge=7, le=365)
):
    """주간 적중률 트렌드."""
    data = await backtest_engine.get_accuracy_trend(days)
    return {"status": "ok", "data": data}


@router.get("/patterns/weak")
async def get_weak_patterns(
    days: int = Query(90, ge=7, le=365)
):
    """AI 약점 패턴 분석."""
    data = await backtest_engine.get_weak_patterns(days)
    return {"status": "ok", "data": data}


@router.get("/patterns/strong")
async def get_strong_patterns(
    days: int = Query(90, ge=7, le=365)
):
    """AI 강점 패턴 분석."""
    data = await backtest_engine.get_strong_patterns(days)
    return {"status": "ok", "data": data}


@router.get("/match-insight")
async def get_match_specific_insight(
    home_team: str = Query(..., description="홈팀 이름 (영문)"),
    away_team: str = Query(..., description="원정팀 이름 (영문)"),
    league: str = Query("", description="리그 키 (e.g., soccer_epl)"),
):
    """
    특정 경기에 대한 과거 기반 인사이트.
    매치 상세 페이지에서 호출.
    """
    try:
        insight = await backtest_engine.get_match_insight(
            home_team=home_team,
            away_team=away_team,
            league=league,
        )
        return {"status": "ok", "insight": insight}
    except Exception as e:
        logger.error(f"Match insight error: {e}")
        return {"status": "error", "message": str(e)}
