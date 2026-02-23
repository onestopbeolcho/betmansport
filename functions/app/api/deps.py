from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError

from app.core import security
from app.core.config import settings
from app.models.user_db import get_user_by_id
from app.schemas.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/access-token")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except (JWTError, ValidationError):
        raise credentials_exception
        
    user_dict = await get_user_by_id(user_id)
    if not user_dict:
        raise credentials_exception
        
    return User(**user_dict)
