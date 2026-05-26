"""
Google Drive API Service — 쇼츠 영상 구글 드라이브 자동 업로드
- 서비스 계정 인증서 기반 Google Drive 연동
- 사용자가 서비스 계정 이메일에 공유한 폴더 자동 탐지 (sharedWithMe)
- 동영상 업로드 후 공유 가능한 모바일 다이렉트 다운로드 링크 생성
"""
import os
import logging
from typing import Optional
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

logger = logging.getLogger(__name__)


class GoogleDriveService:
    def __init__(self):
        self._service = None
        self._credentials = None

    def _init_client(self):
        """Google Drive API 클라이언트 빌드 (서비스 계정 파일 로드)"""
        if self._service is not None:
            return

        cred_path = "smart-proto-inv-2026-firebase-adminsdk-fbsvc-8067fa1f84.json"
        
        # 상대 경로 처리 (스크립트 실행 위치 고려)
        if not os.path.exists(cred_path):
            parent_path = os.path.join("..", cred_path)
            if os.path.exists(parent_path):
                cred_path = parent_path
            else:
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                absolute_path = os.path.join(backend_dir, cred_path)
                if os.path.exists(absolute_path):
                    cred_path = absolute_path
                else:
                    logger.error("❌ Google Drive: Service Account JSON 파일을 찾을 수 없습니다.")
                    return

        try:
            scopes = ['https://www.googleapis.com/auth/drive']
            self._credentials = Credentials.from_service_account_file(cred_path, scopes=scopes)
            self._service = build('drive', 'v3', credentials=self._credentials)
            logger.info("✅ Google Drive API 클라이언트 초기화 완료 (서비스 계정 사용)")
        except Exception as e:
            logger.error(f"❌ Google Drive API 클라이언트 초기화 실패: {e}")

    @property
    def is_configured(self) -> bool:
        self._init_client()
        return self._service is not None

    def find_shared_folder(self) -> Optional[str]:
        """
        영상을 업로드할 구글 드라이브 폴더 ID를 결정합니다.
        1. Firestore에 설정된 GOOGLE_DRIVE_FOLDER_ID 환경변수가 있다면 우선 사용.
        2. 설정이 없다면 서비스 계정에 공유된 폴더들을 자동으로 탐지하여 사용 (sharedWithMe).
        """
        # 1. 환경변수 확인
        env_folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "").strip()
        if env_folder_id:
            logger.info(f"📁 설정된 구글 드라이브 폴더 ID 사용: {env_folder_id}")
            return env_folder_id

        # 2. 공유받은 폴더 자동 탐지
        if not self.is_configured:
            return None

        try:
            logger.info("🔍 서비스 계정에 공유된 구글 드라이브 폴더 자동 탐지 중...")
            query = "mimeType = 'application/vnd.google-apps.folder' and sharedWithMe = true"
            results = self._service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, createdTime)'
            ).execute()
            
            folders = results.get('files', [])
            if folders:
                # 'scorenix'가 이름에 들어간 폴더 우선 매칭
                for f in folders:
                    if 'scorenix' in f['name'].lower():
                        logger.info(f"✨ [자동탐지] 스코어닉스 폴더 발견: '{f['name']}' (ID: {f['id']})")
                        return f['id']
                
                # 그 외에는 가장 최근에 공유받은 폴더 사용
                folders.sort(key=lambda x: x.get('createdTime', ''), reverse=True)
                first_folder = folders[0]
                logger.info(f"✨ [자동탐지] 공유된 폴더 발견: '{first_folder['name']}' (ID: {first_folder['id']})")
                return first_folder['id']
            
            logger.warning("⚠️ 서비스 계정에 공유된 폴더를 찾을 수 없습니다. (폴더 공유 및 편집자 권한 부여 여부를 확인해 주세요.)")
            return None
        except Exception as e:
            logger.error(f"❌ 공유 폴더 자동 탐지 실패: {e}")
            return None

    def upload_video(self, local_path: str) -> Optional[str]:
        """
        로컬 비디오 파일을 구글 드라이브에 업로드합니다.
        자동으로 탐지된 공유 폴더 안으로 업로드합니다.
        Returns:
            webViewLink (구글 드라이브에서 직접 조회/다운로드 가능한 링크)
        """
        if not self.is_configured:
            logger.error("Google Drive API가 설정되지 않았습니다.")
            return None

        if not os.path.exists(local_path):
            logger.error(f"로컬 파일이 존재하지 않습니다: {local_path}")
            return None

        # 업로드 대상 폴더 검색
        folder_id = self.find_shared_folder()
        if not folder_id:
            logger.error("❌ 영상을 업로드할 공유 폴더를 찾을 수 없어 업로드를 중단합니다.")
            return None

        filename = os.path.basename(local_path)
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }

        # mp4 동영상 스트리밍 업로드 설정
        media = MediaFileUpload(local_path, mimetype='video/mp4', resumable=True)

        try:
            logger.info(f"📤 구글 드라이브로 쇼츠 업로드 시작: {filename}...")
            file = self._service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink'
            ).execute()
            
            file_id = file.get('id')
            web_link = file.get('webViewLink')
            
            logger.info(f"✅ 구글 드라이브 업로드 성공! 파일 ID: {file_id}")
            logger.info(f"🔗 모바일 다운로드 링크: {web_link}")
            return web_link
            
        except Exception as e:
            logger.error(f"❌ 구글 드라이브 업로드 실패: {e}")
            return None


# 싱글톤 인스턴스 제공
google_drive_service = GoogleDriveService()
