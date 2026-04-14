import hashlib
from typing import Dict, Any, List

class SoccerStatsService:
    def __init__(self):
        # 향후 실제 API 키가 들어갈 자리
        self.api_key = None
        self.base_url = "https://api-football-v1.p.rapidapi.com/v3"

    def _generate_deterministic_mock(self, team_name: str) -> Dict[str, Any]:
        """
        문자열 해시를 통해 일관된 Mock 팀 스탯을 생성합니다.
        (운영 중 실제 API 연동 전까지 데이터 테스트에 사용됨)
        """
        # 해시값을 0~1 사이 float로 변환
        hash_val = int(hashlib.md5(team_name.encode('utf-8')).hexdigest(), 16)
        
        # 기본 능력치 스케일링 (1.0 ~ 2.5 사이의 xG)
        base_strength = (hash_val % 100) / 100.0  # 0.0 ~ 1.0
        
        avg_xG_for = 1.0 + (base_strength * 1.5)
        avg_xG_against = 2.0 - (base_strength * 1.2)  # 잘하는 팀일수록 실점 기대치가 낮음
        
        # 폼 인덱스 (최근 5경기)
        # 0: 최악, 1: 평균, 2: 최고 
        form_index = (hash_val % 200) / 100.0 
        
        # 스케줄 고려 (최근 14일 내 몇 경기 뛰었는지: 1 ~ 4경기)
        matches_last_14_days = (hash_val % 4) + 1
        
        return {
            "avg_xG_for": round(avg_xG_for, 2),
            "avg_xG_against": round(avg_xG_against, 2),
            "avg_home_xG_for": round(avg_xG_for * 1.15, 2),
            "avg_away_xG_for": round(avg_xG_for * 0.85, 2),
            "form_index": round(form_index, 2),
            "possession_avg": round(40.0 + (base_strength * 25.0), 1),
            "matches_last_14_days": matches_last_14_days,
            "injury_impact_score": round((hash_val % 15) / 10.0, 2) # 핵심 선수 결장 타격 (0 ~ 1.5)
        }

    def fetch_team_stats(self, team_names: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        여러 팀의 통계를 한 번에 가져옵니다.
        """
        results = {}
        for team in team_names:
            if not team:
                continue
            # 여기서 실제 API-Football 스탯을 호출해야 합니다.
            # 하지만 MVP 테스트를 위해 임시로 Deterministic Mock 값을 적용합니다.
            results[team] = self._generate_deterministic_mock(team)
            
        return results

soccer_stats_service = SoccerStatsService()
