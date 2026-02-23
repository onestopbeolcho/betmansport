from typing import Any
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError

from app.models.user_db import get_user_by_email, create_user, get_user_by_id
from app.core import security
from pydantic import BaseModel, EmailStr
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/access-token", auto_error=False)


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nickname: str = ""


class Token(BaseModel):
    access_token: str
    token_type: str


class UserInfo(BaseModel):
    id: str
    email: str
    nickname: str
    role: str


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Decode JWT and return current user."""
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", response_model=Token)
async def register(user_in: UserCreate):
    existing_user = await get_user_by_email(user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="이미 등록된 이메일입니다.",
        )

    user_data = {
        "email": user_in.email,
        "hashed_password": security.get_password_hash(user_in.password),
        "nickname": user_in.nickname or user_in.email.split("@")[0],
        "role": "free"
    }

    new_user = await create_user(user_data)

    return {
        "access_token": security.create_access_token(new_user["id"]),
        "token_type": "bearer",
    }


@router.post("/login/access-token", response_model=Token)
async def login_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_by_email(form_data.username)
    if not user or not security.verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="이메일 또는 비밀번호가 일치하지 않습니다.")

    return {
        "access_token": security.create_access_token(user["id"]),
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info from JWT token."""
    return UserInfo(
        id=current_user["id"],
        email=current_user["email"],
        nickname=current_user.get("nickname", current_user["email"].split("@")[0]),
        role=current_user.get("role", "free"),
    )


class GoogleAuthRequest(BaseModel):
    id_token: str


@router.post("/google", response_model=Token)
async def google_login(req: GoogleAuthRequest):
    """
    Verify Firebase ID Token from Google Sign-In.
    If user doesn't exist → create new account.
    Returns JWT access token (same as email/password flow).
    """
    import firebase_admin.auth as firebase_auth

    try:
        decoded = firebase_auth.verify_id_token(req.id_token)
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise HTTPException(status_code=401, detail="유효하지 않은 Google 인증입니다.")

    email = decoded.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="이메일 정보가 없습니다.")

    # Find or create user
    user = await get_user_by_email(email)
    if not user:
        user_data = {
            "email": email,
            "hashed_password": "",  # Google-only users have no password
            "nickname": decoded.get("name", email.split("@")[0]),
            "role": "free",
            "auth_provider": "google",
            "firebase_uid": decoded.get("uid", ""),
        }
        user = await create_user(user_data)
        logger.info(f"New Google user created: {email}")

    return {
        "access_token": security.create_access_token(user["id"]),
        "token_type": "bearer",
    }

