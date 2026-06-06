"""
BaseScenario — 모든 영상 시나리오의 기반 클래스
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod


@dataclass
class OverlayText:
    """화면에 표시할 자막 텍스트 정의"""
    start_sec: float       # 자막 시작 시각 (초)
    end_sec: float         # 자막 종료 시각 (초)
    text: str              # 표시할 텍스트
    position: str = "bottom"  # top / center / bottom
    font_size: int = 52
    color: str = "white"
    box_color: str = "black@0.6"


@dataclass
class Action:
    """Playwright에서 실행할 단일 액션"""
    type: str              # goto / wait / scroll / click / hover / type / highlight / scroll_to
    value: Any = None      # 각 액션에 따른 파라미터
    selector: Optional[str] = None   # CSS 셀렉터
    duration: Optional[float] = None # 지속 시간(초)
    extra: Optional[Dict] = None     # 추가 옵션


class BaseScenario(ABC):
    """
    모든 시나리오가 상속하는 추상 기반 클래스.
    서브클래스에서 steps와 overlay_texts를 정의하세요.
    """
    # 하위 클래스에서 반드시 오버라이드
    name: str = "base"
    description: str = ""
    url: str = "https://scorenix.com"
    duration: float = 30.0
    viewport_width: int = 540
    viewport_height: int = 960

    # 자동 로그인 설정 (필요 시 오버라이드)
    requires_login: bool = False
    login_email: str = ""
    login_password: str = ""

    @property
    @abstractmethod
    def steps(self) -> List[Action]:
        """Playwright 실행 액션 목록 (순서대로 실행)"""
        ...

    @property
    @abstractmethod
    def overlay_texts(self) -> List[OverlayText]:
        """영상에 합성할 자막 목록"""
        ...
