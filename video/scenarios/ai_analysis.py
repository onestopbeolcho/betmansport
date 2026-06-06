"""
시나리오 3: AI 분석 시연 (AI Analysis Demo)
/analysis 페이지에서 질문 입력 → 분석 결과 출력 과정을 보여주는 영상
로그인 필요
"""
from .base import BaseScenario, Action, OverlayText
from typing import List
import os


class AIAnalysisScenario(BaseScenario):
    name = "ai_analysis"
    description = "AI 분석 시연 — 채팅으로 경기 분석하는 과정 실시간 공개"
    url = "https://scorenix.com/analysis"
    duration = 60.0
    requires_login = True
    login_email = os.environ.get("SCORENIX_TEST_EMAIL", "")
    login_password = os.environ.get("SCORENIX_TEST_PASSWORD", "")

    @property
    def steps(self) -> List[Action]:
        return [
            # 1. 로그인 (producer.py에서 requires_login 감지 시 자동 처리)
            Action(type="goto", value="https://scorenix.com/login"),
            Action(type="wait", duration=2.0),
            Action(type="type", selector="input[type='email'], input[name='email']", value=self.login_email),
            Action(type="type", selector="input[type='password'], input[name='password']", value=self.login_password),
            Action(type="click", selector="button[type='submit'], button:has-text('로그인'), button:has-text('Login')"),
            Action(type="wait", duration=3.0),

            # 2. 분석 페이지로 이동
            Action(type="goto", value=self.url),
            Action(type="wait", duration=3.0),

            # 3. 채팅 입력창에 질문 타이핑 (천천히, 사람처럼)
            Action(type="click", selector="textarea, input[type='text'], [class*='input'], [class*='chat']"),
            Action(type="wait", duration=1.0),
            Action(type="type_slow",
                   selector="textarea, input[type='text'], [class*='input'], [class*='chat']",
                   value="오늘 첼시 vs 맨시티 경기 분석해줘",
                   duration=3.0),
            Action(type="wait", duration=1.0),

            # 4. 전송 버튼 클릭
            Action(type="click", selector="button[type='submit'], [class*='send'], [aria-label*='전송']"),
            Action(type="wait", duration=2.0),

            # 5. AI 응답 로딩 대기
            Action(type="wait", duration=8.0),

            # 6. 응답 결과 천천히 스크롤
            Action(type="scroll", value=300, duration=5.0),
            Action(type="wait", duration=2.0),
            Action(type="scroll", value=700, duration=6.0),
            Action(type="wait", duration=3.0),
            Action(type="scroll", value=1200, duration=6.0),
            Action(type="wait", duration=2.5),
        ]

    @property
    def overlay_texts(self) -> List[OverlayText]:
        return [
            OverlayText(0, 5, "AI한테 경기 분석 시켜봄 🤖", position="center", font_size=56),
            OverlayText(6, 14, "\"오늘 첼시 vs 맨시티 분석해줘\"", position="bottom", font_size=44),
            OverlayText(16, 26, "AI가 배당 데이터 + 통계 분석 중...", position="bottom", font_size=44),
            OverlayText(28, 40, "승률, 배당 추천, 위험도까지 한 번에", position="bottom", font_size=44),
            OverlayText(42, 52, "이 분석이 전부 무료입니다", position="bottom", font_size=48),
            OverlayText(54, 60, "scorenix.com — 지금 바로 써보세요", position="bottom", font_size=42),
        ]
