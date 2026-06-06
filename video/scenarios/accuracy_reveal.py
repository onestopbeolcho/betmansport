"""
시나리오 1: 적중률 공개 (Accuracy Reveal)
/accuracy 페이지에서 AI 적중률 숫자와 차트를 보여주는 영상
"""
from .base import BaseScenario, Action, OverlayText
from typing import List


class AccuracyRevealScenario(BaseScenario):
    name = "accuracy_reveal"
    description = "AI 적중률 공개 — 숫자와 차트를 강조하며 신뢰도 어필"
    url = "https://scorenix.com/accuracy"
    duration = 35.0
    requires_login = False

    @property
    def steps(self) -> List[Action]:
        return [
            # 1. 페이지 접속 및 로딩 대기
            Action(type="goto", value=self.url),
            Action(type="wait", duration=2.5),

            # 2. 상단 적중률 숫자 강조 (줌인 효과)
            Action(type="highlight", selector=".accuracy-hero, [class*='accuracy'], [class*='Accuracy'], h1, .hero-stat", duration=3.0),

            # 3. 첫 섹션 천천히 스크롤
            Action(type="scroll", value=300, duration=4.0),
            Action(type="wait", duration=1.5),

            # 4. 월별 차트 구간까지 스크롤
            Action(type="scroll", value=600, duration=5.0),
            Action(type="wait", duration=2.0),

            # 5. 리스트 구간 스크롤
            Action(type="scroll", value=900, duration=5.0),
            Action(type="wait", duration=1.5),

            # 6. 계속 아래로
            Action(type="scroll", value=1500, duration=6.0),
            Action(type="wait", duration=2.0),

            # 7. 맨 위로 빠르게 되돌아오기 (루프 느낌)
            Action(type="scroll_top", duration=1.5),
            Action(type="wait", duration=2.0),
        ]

    @property
    def overlay_texts(self) -> List[OverlayText]:
        return [
            OverlayText(0, 4, "🤖 AI 적중률 공개합니다", position="center", font_size=58),
            OverlayText(4, 12, "이번 달 실제 데이터 기준", position="bottom", font_size=46),
            OverlayText(14, 22, "경기별 예측 결과 전부 공개", position="bottom", font_size=46),
            OverlayText(24, 30, "scorenix.com 에서 직접 확인하세요", position="bottom", font_size=42),
            OverlayText(30, 35, "팔로우하면 매일 결과 알려드려요 👇", position="bottom", font_size=44),
        ]
