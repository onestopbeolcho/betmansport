from pydantic import BaseModel
from typing import Optional
import json
import os

CONFIG_FILE_PATH = "system_config.json"

class SystemConfig(BaseModel):
    pinnacle_api_key: str = ""
    betman_user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    scrape_interval_minutes: int = 10
    
    @classmethod
    def load(cls) -> 'SystemConfig':
        if not os.path.exists(CONFIG_FILE_PATH):
            return cls()
        try:
            with open(CONFIG_FILE_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return cls(**data)
        except Exception:
            return cls()

    def save(self):
        with open(CONFIG_FILE_PATH, 'w', encoding='utf-8') as f:
            f.write(self.json(indent=2))

# Global Config Instance
config = SystemConfig.load()
