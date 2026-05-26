"""
Google Drive Upload Integration Verification Script
- Google Drive API 연결 및 공유된 폴더 자동 탐지 테스트
- 임시 텍스트/영상 파일을 공유 폴더에 업로드하여 링크 생성 테스트
"""
import asyncio
import os
import sys

# 프로젝트 루트 경로 추가 (app 패키지 찾기 위함)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.config_db import load_config_to_env

# Firestore 설정 환경변수로 로드
print("[KEY] Loading Firestore configurations...")
load_config_to_env()

from app.services.google_drive_service import google_drive_service


async def verify_google_drive():
    print("=" * 60)
    print("Google Drive Upload Verification Script")
    print("=" * 60)

    # 1. API 클라이언트 설정 상태 확인
    print("\n[1] Google Drive API Client Initialization:")
    if not google_drive_service.is_configured:
        print("[-] Google Drive API is not initialized. Please check service account key file.")
        return
    print("[OK] Google Drive API Client successfully initialized!")

    # 2. 공유받은 폴더 자동 탐지 테스트
    print("\n[2] Auto-detecting Shared Folder:")
    folder_id = google_drive_service.find_shared_folder()
    if not folder_id:
        print("[-] No shared folders detected! Please ensure the folder is shared with the service account email:")
        print("   -> firebase-adminsdk-fbsvc@smart-proto-inv-2026.iam.gserviceaccount.com")
        print("   -> Ensure the permission is set to [Editor / 편집자].")
        return
    print(f"[OK] Successfully auto-detected Target Folder ID: {folder_id}")

    # 3. 임시 파일 업로드 테스트
    print("\n[3] Uploading a test file to Google Drive:")
    test_file_path = "test_gdrive_sync_check.mp4"
    
    # 1초 분량의 dummy mp4 파일 생성 (또는 임시 텍스트를 파일로 저장)
    # 실제 동영상 형식을 위해 간단히 텍스트 내용으로 가짜 mp4 파일을 만듭니다.
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write("Scorenix Auto-Upload System Verification File. Feel free to delete.")

    try:
        drive_link = google_drive_service.upload_video(test_file_path)
        if drive_link:
            print("\n" + "=" * 60)
            print("SUCCESS! Google Drive integration is fully working!")
            print(f"Direct Download / View Link:\n   {drive_link}")
            print("=" * 60)
        else:
            print("[-] Google Drive file upload failed.")
    finally:
        # 임시 파일 삭제
        if os.path.exists(test_file_path):
            os.remove(test_file_path)


if __name__ == '__main__':
    asyncio.run(verify_google_drive())
