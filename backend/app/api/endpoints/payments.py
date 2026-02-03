from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user_db import PaymentDB, UserDB
from app.api.endpoints.auth import router as auth_router # Import deps if needed, but we need get_current_user logic which isn't creating in auth.py yet. 
# Access token verifies user, but we need a 'get_current_user' dep. 
# I will add a simple get_current_user stub or implementation here or in deps.py. 
# For speed, I'll impl here for now and refactor later.

from app.core import security
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/access-token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(UserDB).filter(UserDB.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

router = APIRouter()

class PaymentRequestSchema(BaseModel):
    amount: int
    depositor_name: str

@router.post("/request")
def request_payment(payment: PaymentRequestSchema, current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    new_payment = PaymentDB(
        user_id=current_user.id,
        amount=payment.amount,
        depositor_name=payment.depositor_name,
        status="pending"
    )
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    return {"message": "Payment requested successfully", "id": new_payment.id}

@router.get("/my", response_model=List[PaymentRequestSchema])
def get_my_payments(current_user: UserDB = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(PaymentDB).filter(PaymentDB.user_id == current_user.id).all()
