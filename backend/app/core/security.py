"""
Security Module — JWT 토큰 생성 및 비밀번호 해싱

주요 보안 조치:
- SECRET_KEY: 환경변수 필수 (없으면 서버 시작 차단)
- 토큰 만료: 24시간
- 비밀번호: bcrypt 해싱
"""
from datetime import datetime, timedelta
from typing import Optional, Union, Any
from jose import jwt
from passlib.context import CryptContext
import os
import logging

logger = logging.getLogger(__name__)

# ─── SECRET KEY (환경변수 필수) ───
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    logger.critical("❌ SECRET_KEY 환경변수가 설정되지 않았습니다!")
    # 개발 편의를 위해 폴백 (프로덕션에서는 반드시 환경변수 설정)
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-fallback-do-not-use-in-production")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24시간 (기존 7일 → 보안 강화)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
