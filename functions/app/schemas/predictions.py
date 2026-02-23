from pydantic import BaseModel
from typing import Optional, List, Dict


class TeamStats(BaseModel):
    """팀 시즌 통계 (API-Football or football-data.org)"""
    team_name: str
    team_name_ko: Optional[str] = None
    league: str
    season: str
    # Standings
    rank: int = 0
    played: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_diff: int = 0
    points: int = 0
    # Recent Form (last 5 games: W/D/L)
    form: str = ""  # e.g. "WWDLW"
    # Home/Away splits
    home_wins: int = 0
    home_draws: int = 0
    home_losses: int = 0
    away_wins: int = 0
    away_draws: int = 0
    away_losses: int = 0


class H2HRecord(BaseModel):
    """상대전적 (Head-to-Head)"""
    team_a: str
    team_b: str
    total_matches: int = 0
    team_a_wins: int = 0
    team_b_wins: int = 0
    draws: int = 0
    # Recent H2H matches
    recent_results: List[Dict] = []  # [{date, home, away, score}]


class InjuryInfo(BaseModel):
    """부상/결장 정보"""
    team_name: str
    player_name: str
    reason: str = ""  # "Injury", "Suspension", "Other"
    status: str = ""  # "Out", "Doubtful", "Questionable"


class MatchPrediction(BaseModel):
    """AI 경기 예측 결과"""
    match_id: str  # "{team_home}_{team_away}"
    team_home: str
    team_away: str
    team_home_ko: Optional[str] = None
    team_away_ko: Optional[str] = None
    league: str = ""
    sport: str = "Soccer"
    match_time: Optional[str] = None

    # AI Prediction Score (0-100)
    confidence: float = 0.0  # 전체 AI 신뢰도
    recommendation: str = ""  # "HOME", "DRAW", "AWAY"
    home_win_prob: float = 0.0
    draw_prob: float = 0.0
    away_win_prob: float = 0.0

    # Factor breakdown
    factors: List[Dict] = []
    # [{name: "리그 순위", weight: 0.20, score: 75, detail: "3위 vs 14위"}]

    # Supporting data
    home_rank: int = 0
    away_rank: int = 0
    home_form: str = ""
    away_form: str = ""
    h2h_summary: str = ""
    injuries_home: List[str] = []
    injuries_away: List[str] = []

    # External prediction (from API-Football)
    api_prediction: Optional[str] = None  # "Home", "Draw", "Away"
    api_prediction_pct: Optional[Dict] = None  # {home: 60, draw: 20, away: 20}


class PredictionResponse(BaseModel):
    """API 응답용"""
    predictions: List[MatchPrediction] = []
    last_updated: str = ""
    data_sources: List[str] = []
