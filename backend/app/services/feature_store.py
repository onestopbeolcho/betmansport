"""
Feature Store — BigQuery 기반 ML 피처 벡터 생성.
Phase 2 ML 예측 엔진(LightGBM)에 필요한 학습 변수를 추출.
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.services import bigquery_service as bq

logger = logging.getLogger(__name__)

PROJECT_ID = bq.PROJECT_ID
DATASET_ID = bq.DATASET_ID


async def extract_features_for_match(
    home_team: str,
    away_team: str,
    league: str,
    match_date: Optional[str] = None,
) -> Dict[str, float]:
    """
    Generate feature vector for a single match prediction.
    Returns dict of feature_name → value.
    """
    features = {}

    # 1. home_win_rate_last5 & away_win_rate_last5
    home_form = await _get_win_rate_last_n(home_team, 5)
    away_form = await _get_win_rate_last_n(away_team, 5)
    features["home_win_rate_last5"] = home_form["win_rate"]
    features["away_win_rate_last5"] = away_form["win_rate"]
    features["home_draw_rate_last5"] = home_form["draw_rate"]
    features["away_draw_rate_last5"] = away_form["draw_rate"]

    # 2. rest_days (days since last match)
    features["home_rest_days"] = await _get_rest_days(home_team, match_date)
    features["away_rest_days"] = await _get_rest_days(away_team, match_date)

    # 3. h2h_win_rate (head-to-head)
    h2h = await bq.get_h2h_record(home_team, away_team)
    total_h2h = h2h["total"] or 1
    features["h2h_home_win_rate"] = h2h["home_wins"] / total_h2h
    features["h2h_draw_rate"] = h2h["draws"] / total_h2h
    features["h2h_total_matches"] = float(h2h["total"])

    # 4. Rank diff
    home_rank = await _get_team_rank(home_team, league)
    away_rank = await _get_team_rank(away_team, league)
    features["home_rank"] = float(home_rank)
    features["away_rank"] = float(away_rank)
    features["rank_diff"] = float(away_rank - home_rank)  # Positive = home is higher ranked

    # 5. Goals average
    home_goals = await _get_goals_avg(home_team, 10)
    away_goals = await _get_goals_avg(away_team, 10)
    features["home_goals_for_avg"] = home_goals["for"]
    features["home_goals_against_avg"] = home_goals["against"]
    features["away_goals_for_avg"] = away_goals["for"]
    features["away_goals_against_avg"] = away_goals["against"]

    # 6. Home/Away specific performance
    home_venue = await _get_venue_performance(home_team, is_home=True)
    away_venue = await _get_venue_performance(away_team, is_home=False)
    features["home_team_home_win_rate"] = home_venue
    features["away_team_away_win_rate"] = away_venue

    # 7. Points (league standing)
    features["home_points"] = float(await _get_team_points(home_team, league))
    features["away_points"] = float(await _get_team_points(away_team, league))
    features["points_diff"] = features["home_points"] - features["away_points"]

    return features


async def extract_features_with_odds(
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
    Full feature vector including odds-based features.
    This is the primary function called by MLPredictor.
    """
    # Start with base features
    features = await extract_features_for_match(home_team, away_team, league, match_date)

    # Add odds-based implied probabilities
    if home_odds > 1 and away_odds > 1:
        total_implied = (1 / home_odds) + (1 / draw_odds if draw_odds > 1 else 0) + (1 / away_odds)
        features["implied_prob_home"] = (1 / home_odds) / total_implied if total_implied > 0 else 0.33
        features["implied_prob_draw"] = ((1 / draw_odds) / total_implied) if draw_odds > 1 and total_implied > 0 else 0.33
        features["implied_prob_away"] = (1 / away_odds) / total_implied if total_implied > 0 else 0.33
        features["odds_margin"] = total_implied - 1.0  # Bookmaker margin
    else:
        features["implied_prob_home"] = 0.33
        features["implied_prob_draw"] = 0.33
        features["implied_prob_away"] = 0.33
        features["odds_margin"] = 0.0

    # Add injury features
    features["missing_key_players_home"] = float(missing_players_home)
    features["missing_key_players_away"] = float(missing_players_away)
    features["injury_diff"] = float(missing_players_away - missing_players_home)

    # ─── NEW: 골득실 차이 Feature ───
    gf_home = features.get("home_goals_for_avg", 1.2)
    ga_home = features.get("home_goals_against_avg", 1.2)
    gf_away = features.get("away_goals_for_avg", 1.2)
    ga_away = features.get("away_goals_against_avg", 1.2)
    features["goal_diff_home"] = gf_home - ga_home
    features["goal_diff_away"] = gf_away - ga_away
    features["goal_diff_gap"] = (gf_home - ga_home) - (gf_away - ga_away)

    # ─── NEW: API-Football 외부 AI 예측 ───
    # 실시간 예측 데이터는 ai_predictor에서 별도 처리
    # ML Feature로는 기본값 사용 (BigQuery에 적재 시 실제값으로 업데이트)
    features["api_pred_home"] = 0.33
    features["api_pred_draw"] = 0.33
    features["api_pred_away"] = 0.33

    # ─── NEW: 리그별 홈 어드밴티지 계수 ───
    LEAGUE_HOME_ADV = {
        "soccer_epl": 1.05, "soccer_spain_la_liga": 1.12,
        "soccer_germany_bundesliga": 1.08, "soccer_italy_serie_a": 1.10,
        "soccer_france_ligue_one": 1.06, "soccer_turkey_super_lig": 1.25,
        "soccer_greece_super_league": 1.20, "soccer_serbia_superliga": 1.18,
        "soccer_portugal_liga": 1.10, "soccer_belgium_pro_league": 1.05,
        "soccer_brazil_serie_a": 1.15, "soccer_mexico_liga_mx": 1.20,
        "soccer_argentina_liga": 1.18, "soccer_egypt_premier_league": 1.22,
        "soccer_korea_kleague": 1.06, "soccer_japan_jleague": 1.02,
        "soccer_usa_mls": 1.08, "soccer_saudi_pro_league": 1.18,
        "soccer_china_super_league": 1.15,
    }
    features["league_home_adv"] = LEAGUE_HOME_ADV.get(league, 1.05)

    # ─── Stage 2 NEW: 모멘텀 (폼 가속도) ───
    # BigQuery 데이터로는 정확한 폼 문자열이 없으므로, 승률 차이로 대체
    rate_last5_h = features.get("home_win_rate_last5", 0.5)
    rate_last5_a = features.get("away_win_rate_last5", 0.5)
    features["momentum_home"] = rate_last5_h - 0.5   # 0.5 기준 상승/하락
    features["momentum_away"] = rate_last5_a - 0.5

    # ─── Stage 2 NEW: H2H 최근성 점수 ───
    h2h_wr = features.get("h2h_home_win_rate", 0.5)
    h2h_total = features.get("h2h_total_matches", 0)
    # 경기수가 많을수록 신뢰도 가중 (log scale)
    import math
    recency_confidence = min(math.log(h2h_total + 1) / math.log(11), 1.0)  # 10경기면 1.0
    features["h2h_recency_score"] = h2h_wr * recency_confidence

    # ─── Stage 2 NEW: 부상 품질 점수 ───
    # ai_predictor에서 포지션별 감점 계산; ML용은 단순 부상자 수 기반
    features["injury_quality_home"] = features.get("missing_key_players_home", 0) * 7.0  # 평균 감점
    features["injury_quality_away"] = features.get("missing_key_players_away", 0) * 7.0

    return features


def get_feature_names() -> List[str]:
    """Return ordered list of feature names used by the ML model."""
    return [
        # 폼 (4)
        "home_win_rate_last5",
        "away_win_rate_last5",
        "home_draw_rate_last5",
        "away_draw_rate_last5",
        # 체력 (2)
        "home_rest_days",
        "away_rest_days",
        # 상대전적 (3)
        "h2h_home_win_rate",
        "h2h_draw_rate",
        "h2h_total_matches",
        # 순위 (5)
        "home_rank",
        "away_rank",
        "rank_diff",
        "home_points",
        "away_points",
        "points_diff",
        # 공수력 (4)
        "home_goals_for_avg",
        "home_goals_against_avg",
        "away_goals_for_avg",
        "away_goals_against_avg",
        # 홈/원정 (2)
        "home_team_home_win_rate",
        "away_team_away_win_rate",
        # 배당 (4)
        "implied_prob_home",
        "implied_prob_draw",
        "implied_prob_away",
        "odds_margin",
        # 부상 (3)
        "missing_key_players_home",
        "missing_key_players_away",
        "injury_diff",
        # ─── Stage 1 신규 (7) ───
        "goal_diff_home",
        "goal_diff_away",
        "goal_diff_gap",
        "api_pred_home",
        "api_pred_draw",
        "api_pred_away",
        "league_home_adv",
        # ─── Stage 2 신규 (5) ───
        "momentum_home",
        "momentum_away",
        "h2h_recency_score",
        "injury_quality_home",
        "injury_quality_away",
    ]


# ─── Private query helpers ───

async def _get_win_rate_last_n(team: str, n: int = 5) -> Dict[str, float]:
    """Get win/draw/loss rate from last N matches."""
    sql = f"""
    SELECT result,
           CASE
             WHEN (home_team = '{team}' AND result = 'HOME') THEN 'W'
             WHEN (away_team = '{team}' AND result = 'AWAY') THEN 'W'
             WHEN result = 'DRAW' THEN 'D'
             ELSE 'L'
           END as outcome
    FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
    WHERE home_team = '{team}' OR away_team = '{team}'
    ORDER BY match_date DESC
    LIMIT {n}
    """
    results = await bq.query(sql)
    if not results:
        return {"win_rate": 0.33, "draw_rate": 0.33, "loss_rate": 0.33}

    wins = sum(1 for r in results if r.get("outcome") == "W")
    draws = sum(1 for r in results if r.get("outcome") == "D")
    total = len(results) or 1
    return {
        "win_rate": wins / total,
        "draw_rate": draws / total,
        "loss_rate": (total - wins - draws) / total,
    }


async def _get_rest_days(team: str, reference_date: Optional[str] = None) -> float:
    """Get days since team's last match."""
    sql = f"""
    SELECT MAX(match_date) as last_match
    FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
    WHERE home_team = '{team}' OR away_team = '{team}'
    """
    results = await bq.query(sql)
    if not results or not results[0].get("last_match"):
        return 7.0  # Default: assume a week rest

    last_match = results[0]["last_match"]
    if isinstance(last_match, str):
        try:
            last_match = datetime.fromisoformat(last_match.replace("Z", "+00:00"))
        except Exception:
            return 7.0

    ref = datetime.now(timezone.utc)
    if reference_date:
        try:
            ref = datetime.fromisoformat(reference_date.replace("Z", "+00:00"))
        except Exception:
            pass

    # Ensure both are timezone-aware
    if last_match.tzinfo is None:
        from datetime import timezone as tz
        last_match = last_match.replace(tzinfo=tz.utc)

    delta = (ref - last_match).days
    return float(max(0, min(delta, 30)))  # Cap at 30 days


async def _get_team_rank(team: str, league: str) -> int:
    """Get team's current league rank."""
    sql = f"""
    SELECT rank
    FROM `{PROJECT_ID}.{DATASET_ID}.team_stats`
    WHERE team = '{team}' AND league = '{league}'
    ORDER BY updated_at DESC
    LIMIT 1
    """
    results = await bq.query(sql)
    if results and results[0].get("rank"):
        return results[0]["rank"]
    return 10  # Default mid-table


async def _get_goals_avg(team: str, n: int = 10) -> Dict[str, float]:
    """Get average goals for/against from last N matches."""
    sql = f"""
    SELECT
      AVG(CASE WHEN home_team = '{team}' THEN home_score
               WHEN away_team = '{team}' THEN away_score END) as goals_for,
      AVG(CASE WHEN home_team = '{team}' THEN away_score
               WHEN away_team = '{team}' THEN home_score END) as goals_against
    FROM (
      SELECT home_team, away_team, home_score, away_score
      FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
      WHERE home_team = '{team}' OR away_team = '{team}'
      ORDER BY match_date DESC
      LIMIT {n}
    )
    """
    results = await bq.query(sql)
    if results:
        return {
            "for": float(results[0].get("goals_for") or 1.2),
            "against": float(results[0].get("goals_against") or 1.2),
        }
    return {"for": 1.2, "against": 1.2}


async def _get_venue_performance(team: str, is_home: bool) -> float:
    """Get team's win rate at home or away."""
    venue_col = "home_team" if is_home else "away_team"
    win_result = "HOME" if is_home else "AWAY"
    sql = f"""
    SELECT
      COUNTIF(result = '{win_result}') as wins,
      COUNT(*) as total
    FROM `{PROJECT_ID}.{DATASET_ID}.matches_raw`
    WHERE {venue_col} = '{team}'
    """
    results = await bq.query(sql)
    if results and results[0].get("total", 0) > 0:
        return results[0]["wins"] / results[0]["total"]
    return 0.4 if is_home else 0.3  # Default home advantage


async def _get_team_points(team: str, league: str) -> int:
    """Get team's current points in the league."""
    sql = f"""
    SELECT points
    FROM `{PROJECT_ID}.{DATASET_ID}.team_stats`
    WHERE team = '{team}' AND league = '{league}'
    ORDER BY updated_at DESC
    LIMIT 1
    """
    results = await bq.query(sql)
    if results and results[0].get("points"):
        return results[0]["points"]
    return 30  # Default mid-table
