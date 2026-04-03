"""
Feature Store V2 — xG 피처를 포함한 확장 피처 벡터 생성.
기존 feature_store.py를 건드리지 않고, V2에서 기존 + 신규 피처를 통합.

Phase 1: 이 파일만 추가 (기존 코드 수정 없음)
Phase 2 (배포 시): ml_predictor.py에서 feature_store → feature_store_v2로 교체

추가 피처 (기존 28개 → 35개):
  - xG_per_match (홈/원정)
  - xGA_per_match (홈/원정)
  - xG_diff (홈/원정)
  - xG_overperformance (실제 득점 - xG) (홈/원정)
  - ppda_avg (PPDA 압박 강도)
"""
import logging
from typing import Dict, List, Optional

from app.services.feature_store import extract_features_with_odds, get_feature_names
from app.services.understat_xg_service import understat_service

logger = logging.getLogger(__name__)


async def extract_features_v2(
    home_team: str,
    away_team: str,
    league: str,
    home_odds: float = 0,
    draw_odds: float = 0,
    away_odds: float = 0,
    missing_players_home: int = 0,
    missing_players_away: int = 0,
    match_date: Optional[str] = None,
) -> Dict[str, float]:
    """
    확장 피처 벡터 생성 (기존 28개 + xG 7개 = 35개).
    기존 feature_store의 결과에 xG 피처를 추가합니다.
    xG 없으면 기본값(리그 평균) 사용.
    """
    # 기존 28개 피처
    features = await extract_features_with_odds(
        home_team, away_team, league,
        home_odds, draw_odds, away_odds,
        missing_players_home, missing_players_away,
        match_date,
    )

    # xG 피처 추가
    home_xg = await understat_service.get_team_xg(home_team, league)
    away_xg = await understat_service.get_team_xg(away_team, league)

    # xG 기본값 (리그 평균 수준)
    DEFAULT_XG = {
        "xG_per_match": 1.3,
        "xGA_per_match": 1.3,
        "xG_diff": 0.0,
        "xG_overperformance": 0.0,
        "ppda_avg": 10.0,
    }

    if home_xg:
        features["home_xG_per_match"] = home_xg.get("xG_per_match", DEFAULT_XG["xG_per_match"])
        features["home_xGA_per_match"] = home_xg.get("xGA_per_match", DEFAULT_XG["xGA_per_match"])
        features["home_xG_diff"] = home_xg.get("xG_diff", DEFAULT_XG["xG_diff"])
        features["home_xG_overperformance"] = home_xg.get("xG_overperformance", DEFAULT_XG["xG_overperformance"])
    else:
        features["home_xG_per_match"] = DEFAULT_XG["xG_per_match"]
        features["home_xGA_per_match"] = DEFAULT_XG["xGA_per_match"]
        features["home_xG_diff"] = DEFAULT_XG["xG_diff"]
        features["home_xG_overperformance"] = DEFAULT_XG["xG_overperformance"]

    if away_xg:
        features["away_xG_per_match"] = away_xg.get("xG_per_match", DEFAULT_XG["xG_per_match"])
        features["away_xGA_per_match"] = away_xg.get("xGA_per_match", DEFAULT_XG["xGA_per_match"])
        features["away_xG_diff"] = away_xg.get("xG_diff", DEFAULT_XG["xG_diff"])
    else:
        features["away_xG_per_match"] = DEFAULT_XG["xG_per_match"]
        features["away_xGA_per_match"] = DEFAULT_XG["xGA_per_match"]
        features["away_xG_diff"] = DEFAULT_XG["xG_diff"]

    # 팀 간 xG 상대 비교
    features["xG_advantage"] = features["home_xG_per_match"] - features["away_xG_per_match"]

    return features


def get_feature_names_v2() -> List[str]:
    """V2 피처 이름 목록 (기존 28개 + xG 8개 = 36개)."""
    base = get_feature_names()
    xg_features = [
        "home_xG_per_match",
        "home_xGA_per_match",
        "home_xG_diff",
        "home_xG_overperformance",
        "away_xG_per_match",
        "away_xGA_per_match",
        "away_xG_diff",
        "xG_advantage",
    ]
    return base + xg_features
