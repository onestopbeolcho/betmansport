from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM
from typing import Optional

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/access-token", auto_error=False)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[str]:
    """
    Extract user_id from JWT token.
    Returns None if no token is provided (allows anonymous access).
    Raises 401 if token is invalid.
    """
    if token is None:
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no subject",
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def require_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Strict version — requires valid JWT. Returns user_id.
    Raises 401 if no token or invalid token.
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: no subject",
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


ADMIN_WHITELIST_EMAILS = {
    "miso87254591@gmail.com",
    "miso4591@naver.com",
    "phone_821087254591@scorenix.phone",
    "scorenix@gmail.com",
}
ADMIN_WHITELIST_PHONES = {
    "01087254591",
    "+821087254591",
    "821087254591",
}


def is_admin_user(user: dict) -> bool:
    if not user:
        return False
    if str(user.get("role", "")).lower() == "admin" or str(user.get("tier", "")).lower() == "admin":
        return True
    email = str(user.get("email", "")).strip().lower()
    if email in ADMIN_WHITELIST_EMAILS:
        return True
    phone = str(user.get("phone", "")).replace("-", "").replace(" ", "").strip()
    if phone in ADMIN_WHITELIST_PHONES:
        return True
    return False


async def require_admin(user_id: str = Depends(require_current_user)) -> str:
    """
    Admin Guard — JWT에서 user_id 추출 후 Firestore에서 role 또는 화이트리스트 확인.
    """
    from app.models.user_db import get_user_by_id, update_user

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not is_admin_user(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다.",
        )

    if user.get("role") != "admin":
        try:
            await update_user(user_id, {"role": "admin"})
        except Exception:
            pass

    return user_id
