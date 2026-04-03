"""
ETL Pipeline — Extract, Transform, Load from external APIs to BigQuery.
Orchestrates data flow from API-Football, The Odds API → BigQuery Data Lake.
Runs as part of scheduler (nightly batch) or manually.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional

from app.services import bigquery_service as bq
from app.services.pinnacle_api import pinnacle_service

logger = logging.getLogger(__name__)


async def etl_odds_to_bigquery(odds_items: list) -> int:
    """
    Transform OddsItem list from The Odds API → BigQuery odds_history.
    Called after odds collection in scheduler.
    """
    if not odds_items:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for item in odds_items:
        try:
            row = {
                "match_id": f"{item.team_home}_{item.team_away}_{item.match_time or ''}",
                "provider": "pinnacle",
                "league": getattr(item, "league", "") or "",
                "home_team": item.team_home,
                "away_team": item.team_away,
                "home_odds": float(item.home_odds) if item.home_odds else 0,
                "draw_odds": float(item.draw_odds) if item.draw_odds else 0,
                "away_odds": float(item.away_odds) if item.away_odds else 0,
                "match_time": item.match_time or now,
                "collected_at": now,
            }
            rows.append(row)
        except Exception as e:
            logger.warning(f"ETL odds transform error: {e}")
            continue

    if rows:
        success = await bq.insert_rows("odds_history", rows)
        if success:
            logger.info(f"✅ ETL: {len(rows)} odds records → BigQuery")
        return len(rows)
    return 0


async def etl_standings_to_bigquery(standings_data: Dict[str, list]) -> int:
    """
    Transform standings data → BigQuery team_stats.
    standings_data: {league_key: [TeamStats, ...]}
    """
    if not standings_data:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for league, teams in standings_data.items():
        for team in teams:
            try:
                # Handle both dict and object
                if isinstance(team, dict):
                    t = team
                else:
                    t = team.__dict__ if hasattr(team, "__dict__") else {}

                row = {
                    "team": t.get("team", t.get("name", "")),
                    "league": league,
                    "season": t.get("season", "2025-26"),
                    "rank": int(t.get("rank", t.get("position", 0))),
                    "points": int(t.get("points", 0)),
                    "played": int(t.get("played", t.get("matches_played", 0))),
                    "wins": int(t.get("wins", t.get("won", 0))),
                    "draws": int(t.get("draws", t.get("draw", 0))),
                    "losses": int(t.get("losses", t.get("lost", 0))),
                    "goals_for": int(t.get("goals_for", t.get("goalsFor", 0))),
                    "goals_against": int(t.get("goals_against", t.get("goalsAgainst", 0))),
                    "goal_diff": int(t.get("goal_diff", t.get("goalDifference", 0))),
                    "form_last5": t.get("form", t.get("form_last5", "")),
                    "home_wins": int(t.get("home_wins", 0)),
                    "home_draws": int(t.get("home_draws", 0)),
                    "home_losses": int(t.get("home_losses", 0)),
                    "away_wins": int(t.get("away_wins", 0)),
                    "away_draws": int(t.get("away_draws", 0)),
                    "away_losses": int(t.get("away_losses", 0)),
                    "updated_at": now,
                }
                rows.append(row)
            except Exception as e:
                logger.warning(f"ETL standings transform error: {e}")
                continue

    if rows:
        success = await bq.insert_rows("team_stats", rows)
        if success:
            logger.info(f"✅ ETL: {len(rows)} team stats → BigQuery")
        return len(rows)
    return 0


async def etl_match_results_to_bigquery(fixtures: List[Dict]) -> int:
    """
    Transform API-Football fixture results → BigQuery matches_raw.
    Used for nightly result collection.
    """
    if not fixtures:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for fix in fixtures:
        try:
            teams = fix.get("teams", {})
            goals = fix.get("goals", {})
            fixture_info = fix.get("fixture", {})
            league_info = fix.get("league", {})

            home_team = teams.get("home", {}).get("name", "")
            away_team = teams.get("away", {}).get("name", "")
            home_score = goals.get("home")
            away_score = goals.get("away")

            if home_score is None or away_score is None:
                continue  # Match not finished

            if home_score > away_score:
                result = "HOME"
            elif home_score < away_score:
                result = "AWAY"
            else:
                result = "DRAW"

            # Stats (if available)
            stats = fix.get("statistics", [])
            home_stats = {}
            away_stats = {}
            if len(stats) >= 2:
                for s in stats[0].get("statistics", []):
                    home_stats[s["type"]] = s["value"]
                for s in stats[1].get("statistics", []):
                    away_stats[s["type"]] = s["value"]

            row = {
                "match_id": str(fixture_info.get("id", f"{home_team}_{away_team}")),
                "league": league_info.get("name", ""),
                "season": str(league_info.get("season", "")),
                "match_date": fixture_info.get("date", now),
                "home_team": home_team,
                "away_team": away_team,
                "home_score": int(home_score),
                "away_score": int(away_score),
                "result": result,
                "home_shots": _safe_int(home_stats.get("Total Shots")),
                "away_shots": _safe_int(away_stats.get("Total Shots")),
                "home_possession": _safe_pct(home_stats.get("Ball Possession")),
                "away_possession": _safe_pct(away_stats.get("Ball Possession")),
                "home_corners": _safe_int(home_stats.get("Corner Kicks")),
                "away_corners": _safe_int(away_stats.get("Corner Kicks")),
                "venue": fixture_info.get("venue", {}).get("name", ""),
                "referee": fixture_info.get("referee", ""),
                "ingested_at": now,
            }
            rows.append(row)
        except Exception as e:
            logger.warning(f"ETL match result transform error: {e}")
            continue

    if rows:
        success = await bq.insert_rows("matches_raw", rows)
        if success:
            logger.info(f"✅ ETL: {len(rows)} match results → BigQuery")
        return len(rows)
    return 0


def _safe_int(val) -> int:
    """Safely convert to int."""
    if val is None:
        return 0
    try:
        return int(str(val).replace("%", "").strip() or 0)
    except (ValueError, TypeError):
        return 0


def _safe_pct(val) -> float:
    """Safely convert percentage string to float."""
    if val is None:
        return 0.0
    try:
        return float(str(val).replace("%", "").strip() or 0)
    except (ValueError, TypeError):
        return 0.0
