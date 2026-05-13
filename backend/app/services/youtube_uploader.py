import os
import pickle
import logging
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

logger = logging.getLogger(__name__)

# YouTube API 설정
SCOPES = ['https://www.googleapis.com/auth/youtube.upload']
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'youtube_token.pickle'

def get_youtube_service():
    """YouTube API 서비스 객체 생성 및 인증 관리"""
    creds = None
    
    # 1. 기존 토큰 로드
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, 'rb') as token:
            creds = pickle.load(token)
            
    # 2. 토큰이 없거나 만료된 경우 인증 수행
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(f"{CREDENTIALS_FILE} 파일이 없습니다. Google Cloud Console에서 다운로드하세요.")
            
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
            
        # 3. 새로운 토큰 저장
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
            
    return build('youtube', 'v3', credentials=creds)

def upload_to_youtube(video_path, title, description, tags=None, category_id="22", privacy_status="public"):
    """
    YouTube로 비디오 업로드
    category_id "22"는 'People & Blogs'입니다.
    """
    try:
        youtube = get_youtube_service()
        
        body = {
            'snippet': {
                'title': title,
                'description': description,
                'tags': tags or [],
                'categoryId': category_id
            },
            'status': {
                'privacyStatus': privacy_status,
                'selfDeclaredMadeForKids': False,
            }
        }
        
        media = MediaFileUpload(video_path, chunksize=-1, resumable=True, mimetype='video/mp4')
        
        logger.info(f"📤 YouTube 업로드 시작: {title}")
        request = youtube.videos().insert(
            part=','.join(body.keys()),
            body=body,
            media_body=media
        )
        
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                logger.info(f"Uploading {int(status.progress() * 100)}%...")
                
        video_id = response.get('id')
        logger.info(f"✅ 업로드 완료! 비디오 ID: {video_id}")
        return video_id
        
    except Exception as e:
        logger.error(f"❌ YouTube 업로드 실패: {e}")
        return None
