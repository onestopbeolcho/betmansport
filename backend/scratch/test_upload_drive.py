import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.models.config_db import load_config_to_env
load_config_to_env()

from app.services.google_drive_service import google_drive_service

print("=== Testing Google Drive Upload ===")

# Create a dummy test file
test_file_path = os.path.join(backend_dir, "test_drive_upload.mp4")
with open(test_file_path, "w") as f:
    f.write("This is a dummy test file for Google Drive upload verification.")

try:
    print(f"Uploading dummy file {test_file_path} to Google Drive...")
    link = google_drive_service.upload_video(test_file_path)
    if link:
        print(f"[SUCCESS] Google Drive upload succeeded! Link: {link}")
    else:
        print("[ERROR] Google Drive upload returned None.")
finally:
    # Cleanup
    if os.path.exists(test_file_path):
        os.remove(test_file_path)
        print("Cleaned up local dummy file.")
