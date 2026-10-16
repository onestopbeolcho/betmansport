import os
import sys

# Ensure backend directory is in the path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

print("=== Verification Script ===")
print(f"Backend directory: {backend_dir}")

# 1. Test imports
try:
    import edge_tts
    print("[SUCCESS] Imported edge_tts successfully.")
except Exception as e:
    print(f"[ERROR] Failed to import edge_tts: {e}")

try:
    import gtts
    print("[SUCCESS] Imported gtts successfully.")
except Exception as e:
    print(f"[ERROR] Failed to import gtts: {e}")

# 2. Test importing gemini_service.generate_video_script_korean
try:
    from app.services.gemini_service import generate_video_script_korean
    print("[SUCCESS] Imported generate_video_script_korean successfully.")
except Exception as e:
    print(f"[ERROR] Failed to import generate_video_script_korean: {e}")

# 3. Test generate_shorts_pipeline imports
try:
    import generate_shorts_pipeline
    print("[SUCCESS] Imported generate_shorts_pipeline successfully.")
except Exception as e:
    print(f"[ERROR] Failed to import generate_shorts_pipeline: {e}")

print("=== Verification Finished ===")
