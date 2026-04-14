import asyncio
import os
from app.models.config_db import load_config_to_env
load_config_to_env()
from app.api.endpoints.ai_predictions import get_ai_predictions

async def test():
    p = await get_ai_predictions()
    confs = [m.confidence for m in p.predictions if getattr(m, 'confidence', 0) >= 55]
    print('Confs >= 55:', confs)

asyncio.run(test())
