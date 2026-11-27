from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.models import Customer, LedgerEntry
from app.analytics.credit_aging import calculate_credit_summary
from app.schemas.credit import CreditSummaryResponse, PaymentRecordRequest

router = APIRouter(prefix="/credit", tags=["Customer Credit & Khata"])

@router.get("/summary", response_model=CreditSummaryResponse)
def get_credit_summary_endpoint(store_id: int = 1, db: Session = Depends(get_db)):
    """GET /api/credit/summary: Receivables, aging buckets, overdue list, and Safe Mark scores (CRED-01)."""
    return calculate_credit_summary(db, store_id=store_id)

@router.post("/payment")
def record_customer_payment(
    payload: PaymentRecordRequest,
    store_id: int = 1,
    db: Session = Depends(get_db)
):
    """Records real-time Khata payment, reducing customer balance and logging ledger entry."""
    cust = db.query(Customer).filter(Customer.customer_id == payload.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    entry = LedgerEntry(
        store_id=cust.store_id,
        customer_id=payload.customer_id,
        timestamp=now,
        debit=0.0,
        credit=payload.amount,
        reference="wasooli_counter",
        description=payload.notes or "Counter wasooli"
    )
    db.add(entry)
    db.commit()

    from sqlalchemy import func
    debits = db.query(func.sum(LedgerEntry.debit)).filter(LedgerEntry.customer_id == payload.customer_id).scalar() or 0.0
    credits = db.query(func.sum(LedgerEntry.credit)).filter(LedgerEntry.customer_id == payload.customer_id).scalar() or 0.0
    new_balance = max(0.0, debits - credits)

    return {
        "message": "Payment recorded successfully",
        "customer_id": cust.customer_id,
        "name": cust.name,
        "amount_received": payload.amount,
        "new_balance": new_balance
    }

