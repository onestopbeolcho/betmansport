"""
시나리오 5: 세금 계산기 (Tax Calculator)
/tax 페이지에서 금액 입력 → 세금 계산 결과 실시간 시연
"""
from .base import BaseScenario, Action, OverlayText
from typing import List


class TaxCalculatorScenario(BaseScenario):
    name = "tax_calculator"
    description = "세금 계산기 시연 — 당첨금 세금 자동 계산, 실용적 정보 제공"
    url = "https://scorenix.com/tax"
    duration = 35.0
    requires_login = False

    @property
    def steps(self) -> List[Action]:
        return [
            # 1. 세금 계산기 페이지 접속
            Action(type="goto", value=self.url),
            Action(type="wait", duration=2.5),

            # 2. 금액 입력창 클릭 후 금액 입력
            Action(type="click", selector="input[type='number'], input[type='text'], [class*='amount'], [class*='input']"),
            Action(type="wait", duration=0.8),
            Action(type="clear", selector="input[type='number'], input[type='text'], [class*='amount']"),
            Action(type="type", selector="input[type='number'], input[type='text'], [class*='amount']", value="1000000"),
            Action(type="wait", duration=1.5),

            # 3. 계산 버튼 클릭 (또는 자동 계산)
            Action(type="click", selector="button:has-text('계산'), button[type='submit'], [class*='calc']"),
            Action(type="wait", duration=2.0),

            # 4. 결과 영역 강조
            Action(type="highlight", selector="[class*='result'], [class*='tax'], [class*='amount']", duration=3.0),

            # 5. 더 큰 금액으로 바꿔보기
            Action(type="clear", selector="input[type='number'], input[type='text'], [class*='amount']"),
            Action(type="type", selector="input[type='number'], input[type='text'], [class*='amount']", value="5000000"),
            Action(type="wait", duration=1.0),
            Action(type="click", selector="button:has-text('계산'), button[type='submit'], [class*='calc']"),
            Action(type="wait", duration=2.0),
            Action(type="highlight", selector="[class*='result'], [class*='tax']", duration=3.0),

            # 6. 전체 페이지 스크롤
            Action(type="scroll", value=600, duration=5.0),
            Action(type="wait", duration=2.0),
        ]

    @property
    def overlay_texts(self) -> List[OverlayText]:
        return [
            OverlayText(0, 5, "프로토 당첨되면 세금 얼마?", position="center", font_size=56),
            OverlayText(5, 12, "100만원 당첨 시 실수령액은?", position="bottom", font_size=46),
            OverlayText(14, 22, "500만원 당첨 시 세금은?", position="bottom", font_size=46),
            OverlayText(24, 30, "전부 자동으로 계산해줌 😮", position="bottom", font_size=48),
            OverlayText(30, 35, "scorenix.com 세금 계산기 무료", position="bottom", font_size=42),
        ]
