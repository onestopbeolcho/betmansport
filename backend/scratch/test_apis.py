import os
import sys

# Ensure backend directory is in the path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.models.config_db import load_config_to_env
load_config_to_env()

print("=== Testing Google Drive Service ===")
from app.services.google_drive_service import google_drive_service
print(f"Is Google Drive Configured: {google_drive_service.is_configured}")
if google_drive_service.is_configured:
    try:
        folder_id = google_drive_service.find_shared_folder()
        print(f"[SUCCESS] Google Drive folder found: {folder_id}")
    except Exception as e:
        print(f"[ERROR] Google Drive finding folder failed: {e}")
else:
    print("[ERROR] Google Drive is NOT configured!")

print("\n=== Testing YouTube Service ===")
try:
    from app.services.youtube_uploader import get_youtube_service
    youtube = get_youtube_service()
    print("[SUCCESS] YouTube service initialized successfully!")
except Exception as e:
    print(f"[ERROR] YouTube service initialization failed: {e}")

print("=== Verification Finished ===")
