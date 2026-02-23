from pydantic import BaseModel
from typing import Optional
import json
import os

CONFIG_FILE_PATH = "system_config.json"

class SystemConfig(BaseModel):
    pinnacle_api_key: str = ""
    gemini_api_key: str = ""
    betman_user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    scrape_interval_minutes: int = 10
    
    @classmethod
    def load(cls) -> 'SystemConfig':
        # Priority 1: Environment Variables
        env_key = os.getenv("PINNACLE_API_KEY")
        env_gemini = os.getenv("GEMINI_API_KEY")
        
        # Priority 2: JSON File
        file_data = {}
        if os.path.exists(CONFIG_FILE_PATH):
            try:
                with open(CONFIG_FILE_PATH, 'r', encoding='utf-8') as f:
                    file_data = json.load(f)
            except Exception:
                pass
        
        # Merge (Env overrides File)
        config = cls(**file_data)
        if env_key:
            config.pinnacle_api_key = env_key
        if env_gemini:
            config.gemini_api_key = env_gemini
            
        return config

    def save(self):
        with open(CONFIG_FILE_PATH, 'w', encoding='utf-8') as f:
            f.write(self.json(indent=2))

# Global Config Instance
config = SystemConfig.load()
