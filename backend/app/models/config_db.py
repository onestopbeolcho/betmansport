"""
Firestore 기반 시스템 설정 관리
- API 키를 Firestore에 영구 저장
- 앱 시작 시 자동으로 os.environ에 주입
- 배포할 때마다 환경변수를 재설정할 필요 없음
"""
import os
import logging
from app.db.firestore import get_firestore_db

logger = logging.getLogger(__name__)

CONFIG_COLLECTION = "system_config"
CONFIG_DOC_ID = "main_config"

# Firestore 필드명 → 환경변수명 매핑
# Firestore에 저장할 때는 읽기 쉬운 필드명 사용
# 앱에서는 os.getenv()로 읽으므로 환경변수명으로 변환
FIELD_TO_ENV = {
    "api_football_key": "API_FOOTBALL_KEY",
    "gemini_api_key": "GEMINI_API_KEY",
    "buffer_access_token": "BUFFER_ACCESS_TOKEN",
    "football_data_api_key": "FOOTBALL_DATA_API_KEY",
    "api_basketball_key": "API_BASKETBALL_KEY",
    "live_score_api_key": "LIVE_SCORE_API_KEY",
    "live_score_api_secret": "LIVE_SCORE_API_SECRET",
    "the_odds_api_key": "THE_ODDS_API_KEY",
    "secret_key": "SECRET_KEY",
    "lemon_squeezy_api_key": "LEMON_SQUEEZY_API_KEY",
}


def load_config_to_env():
    """
    Firestore에서 API 키를 읽어 os.environ에 주입.
    이미 환경변수가 설정된 경우 Firestore 값으로 덮어쓰지 않음.
    앱 시작 시 한 번 호출.
    """
    try:
        db = get_firestore_db()
        doc = db.collection(CONFIG_COLLECTION).document(CONFIG_DOC_ID).get()
        if not doc.exists:
            logger.info("📋 Firestore config 없음 — 최초 실행입니다. /api/admin/config에서 설정하세요.")
            return 0

        data = doc.to_dict()
        injected = 0

        for field_name, env_name in FIELD_TO_ENV.items():
            value = data.get(field_name, "")
            if value and not os.getenv(env_name):
                # 환경변수가 비어 있을 때만 Firestore 값 적용
                os.environ[env_name] = str(value)
                # 키 값은 보안을 위해 마스킹
                masked = value[:4] + "..." + value[-4:] if len(str(value)) > 8 else "****"
                logger.info(f"  🔑 {env_name} = {masked} (from Firestore)")
                injected += 1
            elif value and os.getenv(env_name):
                logger.info(f"  ✅ {env_name} already set (env var takes priority)")

        logger.info(f"📋 Firestore config 로드 완료: {injected}개 키 주입됨")
        return injected

    except Exception as e:
        logger.warning(f"⚠️ Firestore config 로드 실패 (계속 진행): {e}")
        return 0


async def get_system_config():
    """Firestore에서 현재 설정 조회"""
    try:
        db = get_firestore_db()
        doc = db.collection(CONFIG_COLLECTION).document(CONFIG_DOC_ID).get()
        if doc.exists:
            return doc.to_dict()
    except Exception:
        pass
    return {}


async def update_system_config(data: dict):
    """Firestore에 설정 저장 + 즉시 os.environ에도 반영"""
    db = get_firestore_db()
    db.collection(CONFIG_COLLECTION).document(CONFIG_DOC_ID).set(data, merge=True)

    # 저장한 값을 즉시 환경변수에도 반영
    for field_name, env_name in FIELD_TO_ENV.items():
        value = data.get(field_name, "")
        if value:
            os.environ[env_name] = str(value)

    return data
