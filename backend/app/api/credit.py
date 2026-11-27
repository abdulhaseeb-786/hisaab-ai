from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.credit_aging import calculate_credit_summary, customer_ledger
from app.core.clock import store_now
from app.core.database import get_db
from app.models import Customer, LedgerEntry
from app.schemas.credit import (
    CreditSummaryResponse, CustomerLedgerResponse, PaymentRecordRequest, PaymentRecordResponse,
)

router = APIRouter(prefix="/credit", tags=["Customer Khata"])


@router.get("/summary", response_model=CreditSummaryResponse)
def get_credit_summary(store_id: int = 1, db: Session = Depends(get_db)):
    """Khata balances, aging by days past due, and Safe Mark scores with reasons (CRED-01)."""
    return calculate_credit_summary(db, store_id=store_id)


@router.get("/customers/{customer_id}", response_model=CustomerLedgerResponse)
def get_customer_ledger(customer_id: int, store_id: int = 1, db: Session = Depends(get_db)):
    """One customer's khata page with a running balance."""
    data = customer_ledger(db, customer_id, store_id=store_id)
    if not data:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return data


@router.post("/payment", response_model=PaymentRecordResponse)
def record_customer_payment(payload: PaymentRecordRequest, db: Session = Depends(get_db)):
    """Record a repayment (wasooli). It cannot be more than the customer owes."""
    cust = db.get(Customer, payload.customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")
    debit, credit = db.query(
        func.coalesce(func.sum(LedgerEntry.debit), 0.0), func.coalesce(func.sum(LedgerEntry.credit), 0.0)
    ).filter(LedgerEntry.customer_id == cust.customer_id).one()
    balance = round(float(debit) - float(credit), 2)
    if payload.amount > balance + 0.01:
        raise HTTPException(status_code=422, detail=f"{cust.name} only owes Rs {balance:,.0f}.")
    db.add(LedgerEntry(store_id=cust.store_id, customer_id=cust.customer_id, timestamp=store_now(),
                       debit=0.0, credit=round(payload.amount, 2), reference="WASOOLI", description=payload.notes))
    db.commit()
    new_balance = round(balance - payload.amount, 2)
    return {
        "customer_id": cust.customer_id,
        "name": cust.name,
        "amount_received": payload.amount,
        "previous_balance": balance,
        "new_balance": new_balance,
        "message": f"Rs {payload.amount:,.0f} received from {cust.name}. Balance now Rs {new_balance:,.0f}.",
    }
