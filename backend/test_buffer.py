import asyncio
import os
import sys
import logging

logging.basicConfig(level=logging.INFO)

from app.models.config_db import load_config_to_env
# Load from Firestore
load_config_to_env()

from app.services.buffer_service import buffer_service

async def test_buffer():
    print('Testing Buffer Configuration...')
    channels = await buffer_service.get_channels(force_refresh=True)
    print(f'Found {len(channels)} channels:')
    for ch in channels:
        print(f" - {ch['service']}: {ch['id']} ({ch['name']})")
    
    print('Attempting to publish a test post...')
    result = await buffer_service.publish_post(
        text='[Scorenix] Automated System Check. Please ignore.',
        image_url='https://storage.googleapis.com/smart-proto-inv-2026-sns-assets/marketing/cards/20260410_124309_test2.png'
    )
    print('Publish result:', result)

if __name__ == '__main__':
    asyncio.run(test_buffer())
