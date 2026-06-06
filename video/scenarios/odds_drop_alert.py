"""
시나리오 2: 배당 급락 경보 (Odds Drop Alert)
/bets 페이지에서 실시간 배당 목록을 탐색하며 긴박감을 연출
"""
from .base import BaseScenario, Action, OverlayText
from typing import List


class OddsDropAlertScenario(BaseScenario):
    name = "odds_drop_alert"
    description = "배당 급락 경보 — 실시간 배당 변동 데이터로 FOMO 자극"
    url = "https://scorenix.com/bets"
    duration = 45.0
    requires_login = False

    @property
    def steps(self) -> List[Action]:
        return [
            # 1. 배당 분석 페이지 접속
            Action(type="goto", value=self.url),
            Action(type="wait", duration=3.0),

            # 2. 첫 번째 배당 카드 위에 마우스 올리기
            Action(type="hover", selector="[class*='bet'], [class*='match'], [class*='card'], article, .card", duration=2.0),
            Action(type="wait", duration=1.5),

            # 3. 천천히 아래로 스크롤 (경기 목록 탐색)
            Action(type="scroll", value=400, duration=5.0),
            Action(type="wait", duration=1.5),

            # 4. 특정 배당값 강조
            Action(type="highlight", selector="[class*='odds'], [class*='ratio'], [class*='rate']", duration=3.0),

            # 5. 더 아래로 스크롤
            Action(type="scroll", value=900, duration=6.0),
            Action(type="wait", duration=2.0),

            # 6. 다시 위로
            Action(type="scroll", value=500, duration=4.0),
            Action(type="wait", duration=1.5),

            # 7. 계속 아래 탐색
            Action(type="scroll", value=1400, duration=8.0),
            Action(type="wait", duration=2.5),

            # 8. 맨 위로
            Action(type="scroll_top", duration=1.5),
            Action(type="wait", duration=2.0),
        ]

    @property
    def overlay_texts(self) -> List[OverlayText]:
        return [
            OverlayText(0, 3, "⚡ 방금 배당이 급락했습니다", position="center", font_size=58),
            OverlayText(3, 10, "실시간 배당 변동 모니터링 중", position="bottom", font_size=46),
            OverlayText(12, 20, "이 배당 — 지금 사야 할까요?", position="bottom", font_size=48),
            OverlayText(22, 32, "AI가 배당 급락 패턴을 분석합니다", position="bottom", font_size=44),
            OverlayText(34, 42, "VIP 가입하면 급락 즉시 알림 💡", position="bottom", font_size=44),
            OverlayText(42, 45, "scorenix.com 지금 무료 체험", position="bottom", font_size=42),
        ]
