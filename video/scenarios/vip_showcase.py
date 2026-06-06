"""
시나리오 4: VIP 기능 공개 (VIP Showcase)
VIP 전용 배당 급락 감지, 콤보 분석, 알림 화면을 탐색
로그인 필요
"""
from .base import BaseScenario, Action, OverlayText
from typing import List
import os


class VIPShowcaseScenario(BaseScenario):
    name = "vip_showcase"
    description = "VIP 기능 공개 — 일반 회원이 못 보는 화면 공개 (업그레이드 유도)"
    url = "https://scorenix.com/vip"
    duration = 45.0
    requires_login = True
    login_email = os.environ.get("SCORENIX_TEST_EMAIL", "")
    login_password = os.environ.get("SCORENIX_TEST_PASSWORD", "")

    @property
    def steps(self) -> List[Action]:
        return [
            # 1. 로그인
            Action(type="goto", value="https://scorenix.com/login"),
            Action(type="wait", duration=2.0),
            Action(type="type", selector="input[type='email'], input[name='email']", value=self.login_email),
            Action(type="type", selector="input[type='password'], input[name='password']", value=self.login_password),
            Action(type="click", selector="button[type='submit'], button:has-text('로그인')"),
            Action(type="wait", duration=3.0),

            # 2. VIP 마켓 페이지
            Action(type="goto", value="https://scorenix.com/vip/market"),
            Action(type="wait", duration=3.0),
            Action(type="scroll", value=400, duration=5.0),
            Action(type="wait", duration=2.0),

            # 3. VIP 알림 페이지
            Action(type="goto", value="https://scorenix.com/vip/alerts"),
            Action(type="wait", duration=3.0),
            Action(type="scroll", value=500, duration=5.0),
            Action(type="wait", duration=2.0),

            # 4. VIP 콤보 분석
            Action(type="goto", value="https://scorenix.com/vip/combo"),
            Action(type="wait", duration=3.0),
            Action(type="scroll", value=400, duration=5.0),
            Action(type="wait", duration=2.0),
        ]

    @property
    def overlay_texts(self) -> List[OverlayText]:
        return [
            OverlayText(0, 4, "공개금지 VIP 화면 봐도 됨? 👀", position="center", font_size=54),
            OverlayText(5, 14, "VIP 전용 — 배당 급락 실시간 감지", position="bottom", font_size=44),
            OverlayText(16, 26, "VIP 전용 — 알림 시스템", position="bottom", font_size=44),
            OverlayText(28, 38, "VIP 전용 — AI 콤보 분석", position="bottom", font_size=44),
            OverlayText(39, 45, "월 구독으로 이 모든 기능 사용 가능", position="bottom", font_size=42),
        ]
