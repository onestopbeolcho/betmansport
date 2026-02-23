from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models.user_db import create_payment, get_user_payments
from app.api.deps import get_current_user
from app.schemas.user import User

router = APIRouter()

class PaymentRequestSchema(BaseModel):
    amount: int
    depositor_name: str

class PaymentResponseSchema(PaymentRequestSchema):
    id: str
    status: str
    created_at: str = None # Return string for simplicity or datetime

    class Config:
        orm_mode = True

@router.post("/request")
async def request_payment(payment: PaymentRequestSchema, current_user: User = Depends(get_current_user)):
    payment_data = {
        "user_id": current_user.id,
        "amount": payment.amount,
        "depositor_name": payment.depositor_name,
        "status": "pending"
    }
    new_payment = await create_payment(payment_data)
    return {"message": "Payment requested successfully", "id": new_payment["id"]}

@router.get("/my")
async def get_my_payments(current_user: User = Depends(get_current_user)):
    payments = await get_user_payments(current_user.id)
    return payments
