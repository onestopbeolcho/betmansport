import os
import time
import logging
from typing import Dict, Any, List
from app.services.espn_fast_service import espn_fast_service

logger = logging.getLogger(__name__)


class SoccerStatsService:
    """
    실제 순위표(ESPN Standings / Football-Data.org) 및 Understat xG 데이터를 결합하여
    팀별 실제 경기당 득점/실점, 최근 5경기 폼, 순위, 승점 지표를 제공하는 서비스.
    (기존 팀명 MD5 해시 기반 가짜 데이터 생성 로직 완전 폐기)
    """
    def __init__(self):
        self.api_key = os.getenv("API_FOOTBALL_KEY")
        self.stats_cache: Dict[str, Any] = {}
        self.cache_ttl = 3600  # 1 hour

    def _calculate_form_index(self, form_str: str) -> float:
        if not form_str:
            return 1.0
        recent = [c for c in form_str.upper() if c in ("W", "D", "L")][-5:]
        if not recent:
            return 1.0
        # 최근 경기일수록 가중치 부여
        weights = [0.8, 0.9, 1.0, 1.1, 1.2][-len(recent):]
        score = 0.0
        max_score = 0.0
        for ch, w in zip(recent, weights):
            max_score += 2.0 * w
            if ch == "W":
                score += 2.0 * w
            elif ch == "D":
                score += 0.8 * w
        return round((score / max(max_score, 1.0)) * 2.0, 2)

    async def fetch_team_stats(self, team_names: List[str]) -> Dict[str, Dict[str, Any]]:
        results: Dict[str, Dict[str, Any]] = {}
        now = time.time()

        # 1. ESPN 전체 리그 순위표가 비어있다면 즉시 로드 (약 0.8초)
        if not espn_fast_service.team_stats_cache:
            try:
                await espn_fast_service.fetch_all_standings()
            except Exception as e:
                logger.warning(f"Failed to preload ESPN standings: {e}")

        # 2. Understat xG 캐시 확인 (블로킹 방지를 위해 캐시된 경우에만 즉시 활용)
        understat_data = {}
        try:
            from app.services.understat_xg_service import understat_service
            understat_data = understat_service.get_cached() or {}
        except Exception:
            understat_data = {}

        for team in team_names:
            if not team:
                continue

            if team in self.stats_cache:
                ts, cached_val = self.stats_cache[team]
                if now - ts < self.cache_ttl:
                    results[team] = cached_val
                    continue

            espn_stat = espn_fast_service.get_team_stat(team)
            if espn_stat:
                avg_gf = float(espn_stat.get("avg_gf", 1.35) or 1.35)
                avg_ga = float(espn_stat.get("avg_ga", 1.35) or 1.35)
                form_str = espn_stat.get("form", "")
                rank = int(espn_stat.get("rank", 0) or 0)
                total_teams = int(espn_stat.get("total_teams", 20) or 20)
                wins = int(espn_stat.get("wins", 0) or 0)
                draws = int(espn_stat.get("draws", 0) or 0)
                losses = int(espn_stat.get("losses", 0) or 0)
                played = int(espn_stat.get("played", wins + draws + losses) or 0)
                goal_diff = int(espn_stat.get("goal_diff", 0) or 0)
                points = int(espn_stat.get("points", 0) or 0)

                # 순위 및 득실 기반 점유율 추정 (상위권일수록 점유율 우위)
                rank_ratio = (total_teams - rank + 1) / max(total_teams, 1) if rank > 0 else 0.5
                est_poss = round(43.0 + rank_ratio * 16.0, 1)

                stats_obj = {
                    "avg_xG_for": round(avg_gf, 2),
                    "avg_xG_against": round(avg_ga, 2),
                    "avg_home_xG_for": round(avg_gf * 1.12, 2),
                    "avg_away_xG_for": round(avg_gf * 0.88, 2),
                    "form_index": self._calculate_form_index(form_str),
                    "form_str": form_str,
                    "possession_avg": est_poss,
                    "matches_last_14_days": 2,
                    "injury_impact_score": 0.0,
                    "rank": rank,
                    "total_teams": total_teams,
                    "played": played,
                    "wins": wins,
                    "draws": draws,
                    "losses": losses,
                    "goal_diff": goal_diff,
                    "points": points,
                    "goals_for": int(espn_stat.get("goals_for", 0) or 0),
                    "goals_against": int(espn_stat.get("goals_against", 0) or 0),
                }
            else:
                # 순위표에 없는 컵대회/하위리그 팀은 중립 베이스라인 사용 (가짜 해시 편향 금지)
                stats_obj = {
                    "avg_xG_for": 1.35,
                    "avg_xG_against": 1.35,
                    "avg_home_xG_for": 1.48,
                    "avg_away_xG_for": 1.22,
                    "form_index": 1.0,
                    "form_str": "",
                    "possession_avg": 50.0,
                    "matches_last_14_days": 2,
                    "injury_impact_score": 0.0,
                    "rank": 0,
                    "total_teams": 20,
                    "played": 0,
                    "wins": 0,
                    "draws": 0,
                    "losses": 0,
                    "goal_diff": 0,
                    "points": 0,
                    "goals_for": 0,
                    "goals_against": 0,
                }

            # Understat 고급 지표 병합
            enriched = False
            for _, teams_dict in understat_data.items():
                for u_name, u_stats in teams_dict.items():
                    if team.lower() in u_name.lower() or u_name.lower() in team.lower():
                        stats_obj["xg_per_match"] = u_stats.get("xG_per_match", stats_obj["avg_xG_for"])
                        stats_obj["xga_per_match"] = u_stats.get("xGA_per_match", stats_obj["avg_xG_against"])
                        stats_obj["ppda_avg"] = u_stats.get("ppda_avg", 10.0)
                        stats_obj["deep_completions"] = u_stats.get("deep_completions", 6)
                        stats_obj["xg_overperformance"] = u_stats.get("xG_overperformance", 0.0)
                        enriched = True
                        break
                if enriched:
                    break

            if not enriched:
                stats_obj["xg_per_match"] = stats_obj["avg_xG_for"]
                stats_obj["xga_per_match"] = stats_obj["avg_xG_against"]
                stats_obj["ppda_avg"] = 10.0
                stats_obj["deep_completions"] = 6
                stats_obj["xg_overperformance"] = 0.0

            self.stats_cache[team] = (now, stats_obj)
            results[team] = stats_obj

        return results


soccer_stats_service = SoccerStatsService()
