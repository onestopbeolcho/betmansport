"""
Backtest Engine — AI 예측 모델 소급 검증 엔진.

핵심 아이디어:
  BigQuery의 과거 데이터(matches_raw + odds_history)에
  현재 AI 예측 모델을 소급 적용하여 "이 분석 방식으로 과거에 얼마나 맞췄는가"를 산출.

  사용자에게 리그별/조건별 적중률, 약점 패턴, 강점 패턴을 제공하여
  "검증된 분석 근거"를 보여주는 차별화 기능.

제공 인사이트:
  1. 리그별 적중률 (EPL 72%, La Liga 68%...)
  2. 배당 구간별 적중률 (1.3~1.6 사이 홈팀 → 정확도 80%)
  3. 약점 패턴 (무승부 예측 정확도 낮음, 언더독 과소평가 등)
  4. 시계열 트렌드 (모델 v1 → v2로 정확도 5% 향상)
  5. 상황별 강점 (홈팀 유리 시 87% 적중)
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.services import bigquery_service as bq

logger = logging.getLogger(__name__)

PROJECT_ID = bq.PROJECT_ID
DATASET_ID = bq.DATASET_ID


class BacktestEngine:
    """과거 데이터 기반 AI 모델 소급 검증 엔진."""

    def __init__(self):
        self._cache: Dict[str, any] = {}
        self._cache_expiry: Optional[datetime] = None

    # ─── 통합 인사이트 API ───

    async def get_full_insights(self, days: int = 90) -> Dict:
        """
        전체 백테스트 인사이트를 통합 반환.
        프론트엔드 대시보드에서 한 번에 호출.
        """
        results = {}

        # 병렬 실행을 위해 각각 호출
        results["overall"] = await self.get_overall_accuracy(days)
        results["by_league"] = await self.get_accuracy_by_league(days)
        results["by_odds_range"] = await self.get_accuracy_by_odds_range(days)
        results["by_confidence"] = await self.get_accuracy_by_confidence(days)
        results["weak_patterns"] = await self.get_weak_patterns(days)
        results["strong_patterns"] = await self.get_strong_patterns(days)
        results["trend"] = await self.get_accuracy_trend(days)
        results["draw_analysis"] = await self.get_draw_accuracy(days)
        results["home_away_bias"] = await self.get_home_away_bias(days)

        return results

    # ─── 1. 전체 적중률 ───

    async def get_overall_accuracy(self, days: int = 90) -> Dict:
        """전체 예측 모델의 정확도 요약."""
        sql = f"""
        SELECT
            COUNT(*) as total_predictions,
            COUNTIF(correct = true) as correct_count,
            COUNTIF(correct = false) as incorrect_count,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct,
            ROUND(AVG(confidence), 3) as avg_confidence,
            ROUND(AVG(log_loss), 4) as avg_log_loss,
            ROUND(AVG(CASE WHEN correct = true THEN confidence ELSE 0 END), 3) as avg_confidence_when_correct,
            ROUND(AVG(CASE WHEN correct = false THEN confidence ELSE 0 END), 3) as avg_confidence_when_wrong,
            model_version
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY model_version
        ORDER BY predicted_at DESC
        LIMIT 1
        """
        results = await bq.query(sql)
        if results:
            return results[0]
        return {
            "total_predictions": 0, "correct_count": 0, "accuracy_pct": 0,
            "avg_confidence": 0, "avg_log_loss": 0, "model_version": "unknown"
        }

    # ─── 2. 리그별 적중률 ───

    async def get_accuracy_by_league(self, days: int = 90) -> List[Dict]:
        """리그별 AI 예측 적중률 — 어떤 리그에서 AI가 강한지."""
        sql = f"""
        SELECT
            m.league,
            COUNT(*) as matches,
            COUNTIF(p.correct = true) as correct,
            ROUND(COUNTIF(p.correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct,
            ROUND(AVG(p.confidence), 3) as avg_confidence,
            ROUND(AVG(p.log_loss), 4) as avg_log_loss
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
        JOIN `{PROJECT_ID}.{DATASET_ID}.matches_raw` m
          ON p.match_id = m.match_id
        WHERE p.actual_result IS NOT NULL
          AND p.predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY m.league
        HAVING COUNT(*) >= 10
        ORDER BY accuracy_pct DESC
        """
        return await bq.query(sql)

    # ─── 3. 배당 구간별 적중률 ───

    async def get_accuracy_by_odds_range(self, days: int = 90) -> List[Dict]:
        """배당 구간별 적중률 — 어떤 배당대에서 AI가 정확한지."""
        sql = f"""
        WITH odds_with_result AS (
            SELECT
                p.match_id,
                p.recommendation,
                p.correct,
                p.confidence,
                o.home_odds,
                o.draw_odds,
                o.away_odds,
                CASE
                    WHEN p.recommendation = 'HOME' THEN o.home_odds
                    WHEN p.recommendation = 'DRAW' THEN o.draw_odds
                    WHEN p.recommendation = 'AWAY' THEN o.away_odds
                    ELSE 0
                END as recommended_odds
            FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
            JOIN `{PROJECT_ID}.{DATASET_ID}.odds_history` o
              ON p.match_id = o.match_id
            WHERE p.actual_result IS NOT NULL
              AND p.predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        )
        SELECT
            CASE
                WHEN recommended_odds < 1.3 THEN '1.0-1.3 (압도적 우세)'
                WHEN recommended_odds < 1.6 THEN '1.3-1.6 (강한 우세)'
                WHEN recommended_odds < 2.0 THEN '1.6-2.0 (약간 우세)'
                WHEN recommended_odds < 2.5 THEN '2.0-2.5 (균형)'
                WHEN recommended_odds < 3.5 THEN '2.5-3.5 (열세)'
                ELSE '3.5+ (약팀)'
            END as odds_range,
            COUNT(*) as matches,
            COUNTIF(correct = true) as correct,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct,
            ROUND(AVG(confidence), 3) as avg_confidence
        FROM odds_with_result
        WHERE recommended_odds > 0
        GROUP BY odds_range
        ORDER BY MIN(recommended_odds)
        """
        return await bq.query(sql)

    # ─── 4. 신뢰도 구간별 적중률 ───

    async def get_accuracy_by_confidence(self, days: int = 90) -> List[Dict]:
        """AI 신뢰도 구간별 실제 적중률 — 신뢰도가 높을수록 정말 잘 맞는가."""
        sql = f"""
        SELECT
            CASE
                WHEN confidence >= 0.75 THEN '🔥 75%+ (매우 높음)'
                WHEN confidence >= 0.60 THEN '✅ 60-75% (높음)'
                WHEN confidence >= 0.45 THEN '⚡ 45-60% (중간)'
                ELSE '⚠️ 45% 미만 (낮음)'
            END as confidence_tier,
            COUNT(*) as matches,
            COUNTIF(correct = true) as correct,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct,
            ROUND(AVG(confidence), 3) as avg_confidence
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY confidence_tier
        ORDER BY MIN(confidence) DESC
        """
        return await bq.query(sql)

    # ─── 5. 약점 패턴 탐지 ───

    async def get_weak_patterns(self, days: int = 90) -> Dict:
        """AI가 자주 틀리는 패턴 탐지 — 오답 노트 기반."""
        # (a) 추천별 정확도 (홈/무/원정)
        sql_by_rec = f"""
        SELECT
            recommendation,
            COUNT(*) as total,
            COUNTIF(correct = true) as correct,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY recommendation
        ORDER BY accuracy_pct ASC
        """
        by_recommendation = await bq.query(sql_by_rec)

        # (b) 틀린 예측의 공통 패턴 — 어떤 실제 결과로 자주 빗나가는가
        sql_miss_pattern = f"""
        SELECT
            recommendation as predicted,
            actual_result as actual,
            COUNT(*) as miss_count,
            ROUND(AVG(confidence), 3) as avg_confidence_when_wrong
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE correct = false
          AND actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY recommendation, actual_result
        ORDER BY miss_count DESC
        LIMIT 10
        """
        miss_patterns = await bq.query(sql_miss_pattern)

        # (c) 고신뢰도인데 틀린 경우 (가장 위험한 패턴)
        sql_overconfident = f"""
        SELECT
            match_id,
            recommendation,
            actual_result,
            ROUND(confidence, 3) as confidence,
            ROUND(log_loss, 4) as log_loss,
            predicted_at
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE correct = false
          AND confidence >= 0.65
          AND actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        ORDER BY confidence DESC
        LIMIT 20
        """
        overconfident_misses = await bq.query(sql_overconfident)

        return {
            "by_recommendation": by_recommendation,
            "miss_patterns": miss_patterns,
            "overconfident_misses": overconfident_misses,
            "analysis_summary": self._generate_weakness_summary(
                by_recommendation, miss_patterns, overconfident_misses
            ),
        }

    # ─── 6. 강점 패턴 ───

    async def get_strong_patterns(self, days: int = 90) -> Dict:
        """AI가 특히 잘 맞추는 패턴 — 마케팅/신뢰도 강화용."""
        # 연속 적중 최대 스트릭
        sql_streak = f"""
        WITH ordered AS (
            SELECT
                correct,
                predicted_at,
                ROW_NUMBER() OVER (ORDER BY predicted_at) as rn,
                SUM(CASE WHEN correct = false THEN 1 ELSE 0 END)
                    OVER (ORDER BY predicted_at) as grp
            FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
            WHERE actual_result IS NOT NULL
              AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        )
        SELECT MAX(streak_len) as max_correct_streak
        FROM (
            SELECT grp, COUNT(*) as streak_len
            FROM ordered
            WHERE correct = true
            GROUP BY grp
        )
        """
        streak_result = await bq.query(sql_streak)

        # 고신뢰도 + 적중 (가장 자신 있었고 맞춘 경기들)
        sql_best = f"""
        SELECT
            match_id,
            recommendation,
            ROUND(confidence, 3) as confidence,
            actual_result,
            predicted_at
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE correct = true
          AND confidence >= 0.70
          AND actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        ORDER BY confidence DESC
        LIMIT 20
        """
        best_calls = await bq.query(sql_best)

        return {
            "max_streak": streak_result[0].get("max_correct_streak", 0) if streak_result else 0,
            "high_confidence_hits": best_calls,
            "total_high_confidence_hits": len(best_calls),
        }

    # ─── 7. 시계열 트렌드 ───

    async def get_accuracy_trend(self, days: int = 90) -> List[Dict]:
        """주간 적중률 트렌드 — AI가 시간이 갈수록 나아지고 있는가."""
        sql = f"""
        SELECT
            DATE_TRUNC(DATE(predicted_at), WEEK) as week_start,
            COUNT(*) as total,
            COUNTIF(correct = true) as correct,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct,
            ROUND(AVG(log_loss), 4) as avg_log_loss,
            ROUND(AVG(confidence), 3) as avg_confidence
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY week_start
        HAVING COUNT(*) >= 5
        ORDER BY week_start
        """
        return await bq.query(sql)

    # ─── 8. 무승부 분석 (전통적 약점) ───

    async def get_draw_accuracy(self, days: int = 90) -> Dict:
        """무승부 예측 상세 분석 — 대부분 AI 모델의 약점."""
        sql = f"""
        SELECT
            'AI가 무승부 예측' as scenario,
            COUNT(*) as total,
            COUNTIF(correct = true) as correct,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE recommendation = 'DRAW'
          AND actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)

        UNION ALL

        SELECT
            '실제 무승부를 맞춤' as scenario,
            COUNTIF(actual_result = 'DRAW') as total,
            COUNTIF(actual_result = 'DRAW' AND recommendation = 'DRAW') as correct,
            ROUND(
                COUNTIF(actual_result = 'DRAW' AND recommendation = 'DRAW') /
                NULLIF(COUNTIF(actual_result = 'DRAW'), 0) * 100, 1
            ) as accuracy_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        """
        return await bq.query(sql)

    # ─── 9. 홈/원정 바이어스 ───

    async def get_home_away_bias(self, days: int = 90) -> Dict:
        """AI의 홈/원정 편향 분석."""
        sql = f"""
        SELECT
            recommendation,
            COUNT(*) as times_recommended,
            COUNTIF(correct = true) as correct,
            ROUND(COUNTIF(correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as recommendation_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log`
        WHERE actual_result IS NOT NULL
          AND predicted_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {days} DAY)
        GROUP BY recommendation
        ORDER BY times_recommended DESC
        """
        return await bq.query(sql)

    # ─── 10. 경기별 백테스트 적용 ───

    async def get_match_insight(self, home_team: str, away_team: str,
                                 league: str) -> Dict:
        """
        특정 경기에 대한 과거 기반 인사이트.
        프론트엔드 매치 상세 페이지에서 호출.
        """
        # H2H 전적
        h2h = await bq.get_h2h_record(home_team, away_team)

        # 이 리그에서의 AI 적중률
        league_accuracy = await self._get_league_accuracy(league)

        # 유사 배당대 경기에서의 적중률
        # (현재 경기 배당을 받아야 하지만 비동기로 처리)

        # 해당 팀이 관련된 과거 예측 성공률
        home_as_home = await self._get_team_home_accuracy(home_team)
        away_as_away = await self._get_team_away_accuracy(away_team)

        return {
            "h2h": h2h,
            "league_ai_accuracy": league_accuracy,
            "home_team_at_home": home_as_home,
            "away_team_at_away": away_as_away,
            "insight_type": "historical_backtest",
            "data_source": "BigQuery predictions_log + matches_raw",
        }

    # ─── Private helpers ───

    async def _get_league_accuracy(self, league: str) -> Dict:
        sql = f"""
        SELECT
            COUNT(*) as total,
            COUNTIF(p.correct = true) as correct,
            ROUND(COUNTIF(p.correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
        JOIN `{PROJECT_ID}.{DATASET_ID}.matches_raw` m ON p.match_id = m.match_id
        WHERE m.league = '{league}'
          AND p.actual_result IS NOT NULL
        """
        results = await bq.query(sql)
        return results[0] if results else {"total": 0, "correct": 0, "accuracy_pct": 0}

    async def _get_team_home_accuracy(self, team: str) -> Dict:
        sql = f"""
        SELECT
            COUNT(*) as total,
            COUNTIF(p.correct = true) as correct,
            ROUND(COUNTIF(p.correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
        JOIN `{PROJECT_ID}.{DATASET_ID}.matches_raw` m ON p.match_id = m.match_id
        WHERE m.home_team = '{team}'
          AND p.actual_result IS NOT NULL
        """
        results = await bq.query(sql)
        return results[0] if results else {"total": 0, "correct": 0, "accuracy_pct": 0}

    async def _get_team_away_accuracy(self, team: str) -> Dict:
        sql = f"""
        SELECT
            COUNT(*) as total,
            COUNTIF(p.correct = true) as correct,
            ROUND(COUNTIF(p.correct = true) / NULLIF(COUNT(*), 0) * 100, 1) as accuracy_pct
        FROM `{PROJECT_ID}.{DATASET_ID}.predictions_log` p
        JOIN `{PROJECT_ID}.{DATASET_ID}.matches_raw` m ON p.match_id = m.match_id
        WHERE m.away_team = '{team}'
          AND p.actual_result IS NOT NULL
        """
        results = await bq.query(sql)
        return results[0] if results else {"total": 0, "correct": 0, "accuracy_pct": 0}

    def _generate_weakness_summary(self, by_rec, miss_patterns, overconfident) -> str:
        """약점 패턴을 자연어 요약으로 생성."""
        summaries = []

        # 가장 약한 추천 유형
        if by_rec:
            worst = min(by_rec, key=lambda x: x.get("accuracy_pct", 100))
            summaries.append(
                f"'{worst.get('recommendation', '?')}' 예측의 정확도가 "
                f"{worst.get('accuracy_pct', 0)}%로 가장 낮습니다."
            )

        # 가장 빈번한 오답 패턴
        if miss_patterns:
            top = miss_patterns[0]
            summaries.append(
                f"'{top.get('predicted', '?')}'를 예측했지만 실제로는 "
                f"'{top.get('actual', '?')}'인 경우가 {top.get('miss_count', 0)}회로 가장 많습니다."
            )

        # 과신 사례
        if overconfident:
            summaries.append(
                f"신뢰도 65% 이상인데 틀린 경우가 {len(overconfident)}건 발견되었습니다."
            )

        return " | ".join(summaries) if summaries else "분석할 데이터가 부족합니다."


# Singleton
backtest_engine = BacktestEngine()
