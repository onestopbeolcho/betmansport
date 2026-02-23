"""
Firestore 클라이언트 (Firebase Admin SDK)

인증 우선순위:
1. GOOGLE_APPLICATION_CREDENTIALS 환경변수 (서비스 계정 키 파일)
2. 프로젝트 내 서비스 계정 키 자동 탐색 (*.json 패턴)
3. Application Default Credentials (Cloud Functions 환경)
"""
import os
import glob
import logging

logger = logging.getLogger(__name__)

_db = None
_initialized = False

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "smart-proto-inv-2026")


def _find_service_account_key() -> str:
    """프로젝트 디렉토리에서 서비스 계정 키 파일 자동 탐색"""
    # backend/app/db/firestore.py → backend/app/db → backend/app → backend → project root
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    
    search_patterns = [
        os.path.join(base_dir, "serviceAccountKey.json"),
        os.path.join(base_dir, "service-account.json"),
        os.path.join(base_dir, "firebase-adminsdk*.json"),
        os.path.join(base_dir, "*-firebase-adminsdk-*.json"),
    ]
    
    for pattern in search_patterns:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return ""


def _init_firebase():
    """Firebase Admin SDK 초기화 (1회만 실행)"""
    global _initialized
    if _initialized:
        return

    import firebase_admin
    from firebase_admin import credentials

    try:
        # 이미 초기화되었는지 확인
        firebase_admin.get_app()
        _initialized = True
        return
    except ValueError:
        pass

    # 1. 환경변수에 지정된 서비스 계정 키
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    
    # 2. 프로젝트 디렉토리에서 자동 탐색
    if not cred_path or not os.path.exists(cred_path):
        cred_path = _find_service_account_key()

    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
        logger.info(f"✅ Firebase initialized with service account: {os.path.basename(cred_path)}")
    else:
        # 3. Cloud Functions 환경 또는 ADC
        try:
            firebase_admin.initialize_app(options={"projectId": PROJECT_ID})
            logger.info(f"✅ Firebase initialized with ADC (project: {PROJECT_ID})")
        except Exception as e:
            logger.error(f"❌ Firebase init failed: {e}")
            logger.error("💡 해결 방법:")
            logger.error("   1. Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성")
            logger.error(f"   2. 파일을 프로젝트 루트에 'serviceAccountKey.json'으로 저장")
            logger.error(f"   3. 또는: set GOOGLE_APPLICATION_CREDENTIALS=<키 파일 경로>")
            raise

    _initialized = True


def get_firestore_db():
    """Firestore 클라이언트 반환 (싱글톤)"""
    global _db
    if _db is None:
        _init_firebase()
        from firebase_admin import firestore
        _db = firestore.client()
        logger.info("✅ Firestore client ready.")
    return _db
