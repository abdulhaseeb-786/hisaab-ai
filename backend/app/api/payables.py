from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.cash_outlook import calculate_cash_outlook
from app.analytics.payables import calculate_payables
from app.core.database import get_db
from app.schemas.credit import CashOutlookResponse, PayablesSummaryResponse

router = APIRouter(prefix="/payables", tags=["Supplier Payables & Cash"])


@router.get("/summary", response_model=PayablesSummaryResponse)
def get_payables_summary(days: int = Query(default=7, ge=1, le=30), store_id: int = 1, db: Session = Depends(get_db)):
    """What the shop owes each distributor: overdue, due soon, and orders still on the way."""
    return calculate_payables(db, store_id=store_id, horizon_days=days)


@router.get("/cash-outlook", response_model=CashOutlookResponse)
def get_cash_outlook(days: int = Query(default=7, ge=1, le=14), store_id: int = 1, db: Session = Depends(get_db)):
    """Day-by-day cash for the next week from today's real cash in hand, with every assumption listed (CASH-01)."""
    return calculate_cash_outlook(db, store_id=store_id, days_ahead=days)
