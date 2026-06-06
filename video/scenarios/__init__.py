"""
Scorenix 자동 영상 시나리오 패키지
각 시나리오는 BaseScenario를 상속하여 구현됩니다.
"""
from .base import BaseScenario, Action, OverlayText
from .accuracy_reveal import AccuracyRevealScenario
from .odds_drop_alert import OddsDropAlertScenario
from .ai_analysis import AIAnalysisScenario
from .vip_showcase import VIPShowcaseScenario
from .tax_calculator import TaxCalculatorScenario

SCENARIO_MAP = {
    "accuracy_reveal": AccuracyRevealScenario,
    "odds_drop_alert": OddsDropAlertScenario,
    "ai_analysis": AIAnalysisScenario,
    "vip_showcase": VIPShowcaseScenario,
    "tax_calculator": TaxCalculatorScenario,
}

__all__ = [
    "BaseScenario", "Action", "OverlayText",
    "AccuracyRevealScenario",
    "OddsDropAlertScenario",
    "AIAnalysisScenario",
    "VIPShowcaseScenario",
    "TaxCalculatorScenario",
    "SCENARIO_MAP",
]
