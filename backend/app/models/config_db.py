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
    "blogger_blog_id": "BLOGGER_BLOG_ID",
    "google_client_id": "BLOGGER_CLIENT_ID",
    "google_client_secret": "BLOGGER_CLIENT_SECRET",
    "google_refresh_token": "BLOGGER_REFRESH_TOKEN",
    "wordpress_url": "WORDPRESS_URL",
    "wordpress_username": "WORDPRESS_USERNAME",
    "wordpress_app_password": "WORDPRESS_APP_PASSWORD",
    "google_drive_folder_id": "GOOGLE_DRIVE_FOLDER_ID",
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
            if value:
                is_prod = bool(os.getenv("K_SERVICE"))
                already_exists = bool(os.getenv(env_name))
                if is_prod or not already_exists:
                    os.environ[env_name] = str(value)
                    masked = value[:4] + "..." + value[-4:] if len(str(value)) > 8 else "****"
                    action_str = "overwrote" if already_exists else "injected"
                    logger.info(f"  🔑 {env_name} = {masked} ({action_str} from Firestore)")
                    injected += 1
                else:
                    logger.info(f"  ✅ {env_name} already set (local env var takes priority)")

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


# ─────────────────────────────────────────────
# Video Config (신규)
# ─────────────────────────────────────────────
VIDEO_CONFIG_DOC_ID = "video_config"

async def get_video_config() -> dict:
    """Firestore에서 비디오 제작 설정(대본, 목소리, 자막 속성 등) 조회. 없으면 디폴트값 반환"""
    try:
        db = get_firestore_db()
        doc = db.collection(CONFIG_COLLECTION).document(VIDEO_CONFIG_DOC_ID).get()
        if doc.exists:
            return doc.to_dict()
    except Exception as e:
        logger.warning(f"⚠️ Failed to get video config: {e}")
    
    # 디폴트 설정값 반환
    return {
        "tts_voice_ko": "ko-KR-SunHiNeural",
        "tts_voice_en": "en-US-EmmaNeural",
        "tts_voice_ja": "ja-JP-NanamiNeural",
        "tts_speed_ko": "+15%",
        "tts_speed_en": "+12%",
        "tts_speed_ja": "+10%",
        "tts_pitch_ko": "+5Hz",
        "tts_pitch_en": "+0Hz",
        "tts_pitch_ja": "+0Hz",
        "subtitle_base_size_intro": 68,
        "subtitle_base_size_match": 54,
        "subtitle_font_ko": "malgun.ttf",
        "subtitle_font_bold_ko": "malgunbd.ttf",
        "winning_intros": [
            "대박! 스코어닉스 AI의 무시무시한 예측 정확도, 숫자로 직접 증명합니다. {today} 적중 결과 리포트 시작합니다.",
            "다들 주목하세요! 어제 AI가 예측한 빅매치가 또 한 번 완벽하게 맞아떨어졌습니다. {today} 적중 현황 공개합니다."
        ],
        "winning_intro_caps": [
            "[HIT REPORT]\n{today} AI 예측\n실제 적중 성과",
            "[AI ACCURACY]\n데이터가 증명한\n실시간 적중 인증"
        ],
        "winning_ctas": [
            "네이버에 스코어닉스를 검색하고 홈페이지에 접속해 보세요! 매일 쏟아지는 경기들의 AI 정밀 분석 픽과 리포트가 전면 무료로 공개되어 있습니다. 지금 바로 확인해 보세요!",
            "구독과 좋아요를 누르고 스코어닉스 닷컴(scorenix.com)에 로그인하시면 모든 예정 경기의 7-Factor 승률 카드를 무제한으로 보실 수 있습니다. 프로필 링크를 클릭해 보세요!"
        ],
        "winning_cta_caps": [
            "네이버 검색창에 [ 스코어닉스 ]\n\nscorenix.com 전면 무료!",
            "7-Factor 실시간 분석 카드\n\n프로필 링크 클릭 시 즉시 확인"
        ],
        "educational_intros": [
            "아직도 느낌과 감으로 경기 결과를 찍고 계신가요? 스포츠 투자로 절대 잃지 않는 핵심 가치 투자 법칙 1가지를 알려드릴게요.",
            "잠깐! 좋아하는 팀을 응원하는 마음으로 베팅하고 있다면 이 영상을 꼭 보세요. 돈을 벌기 위해 반드시 알아야 할 데이터 공식입니다."
        ],
        "educational_intro_caps": [
            "[INVESTMENT MIND]\n스포츠 투자의 패러다임\n감에서 데이터로 바꾸기",
            "[DATA FORMULA]\n돈 버는 투자자들이\n비밀리에 쓰는 분석 원칙"
        ],
        "educational_ctas": [
            "스코어닉스 닷컴(scorenix.com)에서는 이 모든 기대값 분석 결과를 가입 즉시 전면 무료로 실시간 공개하고 있습니다."
        ],
        "educational_cta_caps": [
            "이 모든 기대값 데이터가\n\nscorenix.com 에서 100% 무료!"
        ]
    }


async def update_video_config(data: dict) -> dict:
    """Firestore에 비디오 제작 설정 저장"""
    db = get_firestore_db()
    db.collection(CONFIG_COLLECTION).document(VIDEO_CONFIG_DOC_ID).set(data, merge=True)
    return data
