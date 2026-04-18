import os
import time
import httpx
import logging
import difflib
import hashlib
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class SoccerStatsService:
    def __init__(self):
        self.api_key = os.getenv("API_FOOTBALL_KEY")
        self.base_url = "https://api-football-v1.p.rapidapi.com/v3"
        self.headers = {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
        }
        
        # Target League IDs (EPL, La Liga, Bundesliga, Serie A)
        self.target_leagues = [39, 140, 78, 135]
        self.current_season = 2023 
        
        # Cache memory
        # team_mapping_cache: name -> {"team_id": 33, "league_id": 39}
        self.team_mapping_cache = {}
        # stats_cache: team_name -> (timestamp, dict)
        self.stats_cache = {}
        self.cache_ttl = 86400  # 24 hours
        
        self._mapping_initialized = False

    async def _ensure_mapping(self):
        if self._mapping_initialized or not self.api_key:
            return
            
        logger.info("Initializing Top 4 Leagues Team Mappings from API-Football...")
        async with httpx.AsyncClient() as client:
            for league_id in self.target_leagues:
                try:
                    resp = await client.get(
                        f"{self.base_url}/teams",
                        headers=self.headers,
                        params={"league": league_id, "season": self.current_season},
                        timeout=10.0
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        for item in data.get("response", []):
                            team = item.get("team", {})
                            t_id = team.get("id")
                            t_name = team.get("name")
                            if t_name and t_id:
                                # save mapped by lowercase
                                self.team_mapping_cache[t_name.lower()] = {
                                    "team_id": t_id,
                                    "league_id": league_id
                                }
                except Exception as e:
                    logger.error(f"Failed to fetch teams for league {league_id}: {e}")
            
            self._mapping_initialized = True
            logger.info(f"Team mappings initialized successfully. Cached {len(self.team_mapping_cache)} teams.")

    def _find_mapped_team(self, team_name: str):
        if not team_name: return None
        normalized = team_name.lower()
        # Direct match
        if normalized in self.team_mapping_cache:
            return self.team_mapping_cache[normalized]
        # Fuzzy match
        keys = list(self.team_mapping_cache.keys())
        matches = difflib.get_close_matches(normalized, keys, n=1, cutoff=0.5)
        if matches:
            return self.team_mapping_cache[matches[0]]
        return None

    def _generate_deterministic_mock(self, team_name: str) -> Dict[str, Any]:
        """Fallbacks to deterministic mock when API fails or team unmapped."""
        hash_val = int(hashlib.md5(team_name.encode('utf-8')).hexdigest(), 16)
        base_strength = (hash_val % 100) / 100.0
        
        return {
            "avg_xG_for": round(1.0 + (base_strength * 1.5), 2),
            "avg_xG_against": round(2.0 - (base_strength * 1.2), 2),
            "avg_home_xG_for": round((1.0 + (base_strength * 1.5)) * 1.15, 2),
            "avg_away_xG_for": round((1.0 + (base_strength * 1.5)) * 0.85, 2),
            "form_index": round((hash_val % 200) / 100.0, 2),
            "possession_avg": round(40.0 + (base_strength * 25.0), 1),
            "matches_last_14_days": (hash_val % 4) + 1,
            "injury_impact_score": round((hash_val % 15) / 10.0, 2)
        }

    def _calculate_form_index(self, form_str: str) -> float:
        if not form_str:
            return 1.0 # Average
        # form_str is like 'WWDLD'
        score = 0
        games_counted = len(form_str[-5:])
        if games_counted == 0:
            return 1.0
            
        for char in form_str[-5:]: # Look at the latest up to 5 games
            if char == 'W': score += 2
            elif char == 'D': score += 1
            
        # Max score for 5 games is 10, min is 0 -> map to 0.0 ~ 2.0
        return round((score / (games_counted * 2)) * 2.0, 2)

    async def fetch_team_stats(self, team_names: List[str]) -> Dict[str, Dict[str, Any]]:
        results = {}
        now = time.time()
        
        await self._ensure_mapping()
        
        async with httpx.AsyncClient() as client:
            for team in team_names:
                if not team: continue
                
                # 1. Check cache
                if team in self.stats_cache:
                    ts, data = self.stats_cache[team]
                    if now - ts < self.cache_ttl:
                        results[team] = data
                        continue
                
                # 2. Check API Key presence
                if not self.api_key:
                    results[team] = self._generate_deterministic_mock(team)
                    continue
                
                # 3. Find mapped ID
                mapping = self._find_mapped_team(team)
                if not mapping:
                    # Cannot find mapping (maybe non-top-4 league) -> use mock gracefully
                    logger.debug(f"Cannot find API-Football mapping for team '{team}', using mock fallback.")
                    results[team] = self._generate_deterministic_mock(team)
                    continue
                
                # 4. Fetch Real API
                t_id = mapping["team_id"]
                l_id = mapping["league_id"]
                
                try:
                    resp = await client.get(
                        f"{self.base_url}/teams/statistics",
                        headers=self.headers,
                        params={"season": self.current_season, "team": t_id, "league": l_id},
                        timeout=8.0
                    )
                    if resp.status_code == 200:
                        data = resp.json().get("response", {})
                        if not data:
                            results[team] = self._generate_deterministic_mock(team)
                            continue
                            
                        goals = data.get("goals", {})
                        
                        g_for = goals.get("for", {}).get("average", {}).get("total", "1.0")
                        g_against = goals.get("against", {}).get("average", {}).get("total", "1.0")
                        
                        hg_for = goals.get("for", {}).get("average", {}).get("home", "1.0")
                        ag_for = goals.get("for", {}).get("average", {}).get("away", "1.0")
                        
                        form_str = data.get("form", "")
                        
                        stats_obj = {
                            "avg_xG_for": float(g_for) if g_for else 1.0,
                            "avg_xG_against": float(g_against) if g_against else 1.0,
                            "avg_home_xG_for": float(hg_for) if hg_for else 1.0,
                            "avg_away_xG_for": float(ag_for) if ag_for else 1.0,
                            "form_index": self._calculate_form_index(form_str),
                            "possession_avg": 50.0, # Standard default if omitted
                            "matches_last_14_days": 2, 
                            "injury_impact_score": 0.5
                        }
                        
                        # Save to cache
                        self.stats_cache[team] = (now, stats_obj)
                        results[team] = stats_obj
                    else:
                        logger.warning(f"API-Football Non-200 Response for '{team}': {resp.status_code}")
                        results[team] = self._generate_deterministic_mock(team)
                except Exception as e:
                    logger.warning(f"Error fetching stats for '{team}': {e}")
                    results[team] = self._generate_deterministic_mock(team)
                    
        return results

soccer_stats_service = SoccerStatsService()
