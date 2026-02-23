from abc import ABC, abstractmethod
from typing import List
from app.schemas.odds import OddsItem

class BaseOddsProvider(ABC):
    """
    Abstract Base Class for Odds Providers (API or Crawler).
    """
    
    def __init__(self, provider_name: str):
        self.provider_name = provider_name

    @abstractmethod
    def fetch_odds(self) -> List[OddsItem]:
        """
        Fetch odds from the source.
        Returns a list of OddsItem objects.
        """
        pass
