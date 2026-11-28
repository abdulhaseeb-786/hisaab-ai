from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.analytics.credit_aging import calculate_credit_summary, customer_ledger
from app.core.database import get_db
from app.schemas.credit import (
    CreditCheckRequest, CreditCheckResponse, CreditSummaryResponse, CustomerCreateRequest, CustomerItem,
    CustomerLedgerResponse, PaymentRecordRequest, PaymentRecordResponse, UdhaarRequest, UdhaarResponse,
)
from app.services import khata

router = APIRouter(prefix="/credit", tags=["Customer Khata"])


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except khata.KhataError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/summary", response_model=CreditSummaryResponse)
def get_credit_summary(store_id: int = 1, db: Session = Depends(get_db)):
    """Khata balances, aging by days past due, and Safe Mark scores with reasons (CRED-01)."""
    return calculate_credit_summary(db, store_id=store_id)


@router.get("/customers", response_model=list[CustomerItem])
def list_customers(search: Optional[str] = Query(default=None, max_length=60), store_id: int = 1, db: Session = Depends(get_db)):
    """Every khata customer, most recently active first, for the picker at the counter."""
    return khata.list_customers(db, store_id=store_id, search=search)


@router.post("/customers", response_model=CustomerItem, status_code=201)
def add_customer(payload: CustomerCreateRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Open a new khata."""
    return _run(khata.create_customer, db, payload.name, payload.phone, payload.credit_limit, store_id=store_id)


@router.get("/customers/{customer_id}", response_model=CustomerLedgerResponse)
def get_customer_ledger(customer_id: int, store_id: int = 1, db: Session = Depends(get_db)):
    """One customer's khata page with a running balance and the items bought on each udhaar."""
    data = customer_ledger(db, customer_id, store_id=store_id)
    if not data:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return data


@router.post("/check", response_model=CreditCheckResponse)
def check_credit(payload: CreditCheckRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """'Udhaar dun?' Yes, careful or no for this customer and amount, with the reasons."""
    return _run(khata.credit_check, db, payload.customer_id, payload.amount, store_id=store_id)


@router.post("/udhaar", response_model=UdhaarResponse, status_code=201)
def give_udhaar(payload: UdhaarRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Write udhaar in the khata: who, which items, at what price, and when it is due.

    Items are sold from stock at the shelf price and linked to the khata line. Returns a
    receipt draft to show the customer; nothing is sent anywhere.
    """
    return _run(khata.record_udhaar, db, payload.customer_id, [i.model_dump() for i in payload.items],
                payload.extra_amount, payload.note, store_id=store_id, cash_from_galla=payload.cash_from_galla)


@router.post("/payment", response_model=PaymentRecordResponse)
def record_customer_payment(payload: PaymentRecordRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Record a repayment (wasooli) and how it was paid. It cannot be more than the customer owes.

    Only cash goes into the galla; Easypaisa, JazzCash and bank payments do not.
    """
    return _run(khata.record_payment, db, payload.customer_id, payload.amount, payload.method, payload.notes, store_id=store_id)
