from typing import Dict, Optional
import json
import os

class TeamMapper:
    """
    Handles mapping between different team name representations (e.g., English -> Korean).
    Uses a simple dictionary-based approach, could be backed by DB or JSON file.
    """
    
    def __init__(self, mapping_file: str = "team_mappings.json"):
        self.mapping_file = mapping_file
        self.mappings: Dict[str, str] = self._load_initial_mappings()

    def _load_initial_mappings(self) -> Dict[str, str]:
        # Initial seed data for common teams
        return {
            "Manchester City": "맨체스터 시티",
            "Man City": "맨체스터 시티",  # Added alias for Mock
             "Liverpool": "리버풀",
            "Arsenal": "아스널",
            "Chelsea": "첼시",
            "Tottenham Hotspur": "토트넘",
            "Manchester United": "맨체스터 유나이티드",
            "Real Madrid": "레알 마드리드",
            "Barcelona": "바르셀로나",
            "Bayern Munich": "바이에른 뮌헨",
            "PSG": "파리 생제르맹",
            # Add more as needed or load from file
        }

    def get_korean_name(self, english_name: str) -> Optional[str]:
        """
        Convert English team name to Korean.
        Case-insensitive lookup.
        """
        # Direct lookup
        if english_name in self.mappings:
            return self.mappings[english_name]
            
        # Case insensitive search
        for k, v in self.mappings.items():
            if k.lower() == english_name.lower():
                return v
                
        # Basic heuristic or return None if not found
        return None

    def add_mapping(self, english_name: str, korean_name: str):
        """Add a new mapping pair."""
        self.mappings[english_name] = korean_name
        # In real app, save to DB/File here

    def normalize(self, name: str) -> str:
        """Normalize team name (strip, lower) for comparison."""
        return name.strip()
