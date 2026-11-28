from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.operations import (
    CashCountRequest, DayCloseResponse, DayHistoryItem, DayOpenResponse, DayStatusResponse, ExpenseRequest, ExpenseResponse,
)
from app.services import day

router = APIRouter(tags=["Day: open, close, kharcha"])


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except day.DayError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("/day/today", response_model=DayStatusResponse)
def get_today(store_id: int = 1, db: Session = Depends(get_db)):
    """Is the shop open? What should be in the galla now, and today's figures so far."""
    return day.day_status(db, store_id=store_id)


@router.post("/day/open", response_model=DayOpenResponse)
def open_day(payload: CashCountRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Open the day with the counted galla. A difference from the records is booked."""
    return _run(day.open_day, db, payload.counted_cash, payload.note, store_id=store_id)


@router.post("/day/close", response_model=DayCloseResponse)
def close_day(payload: CashCountRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Close the day with the counted galla. Returns the day's summary and what tomorrow holds."""
    return _run(day.close_day, db, payload.counted_cash, payload.note, store_id=store_id)


@router.get("/day/history", response_model=list[DayHistoryItem])
def get_history(days: int = Query(default=14, ge=1, le=90), store_id: int = 1, db: Session = Depends(get_db)):
    """Past days: opening and closing counts, galla differences, and each day's figures."""
    return day.day_history(db, store_id=store_id, days=days)


@router.post("/expenses", response_model=ExpenseResponse, status_code=201)
def add_expense(payload: ExpenseRequest, store_id: int = 1, db: Session = Depends(get_db)):
    """Kharcha paid from the galla: rent, bijli, salary, transport, or money taken home or banked."""
    return _run(day.record_expense, db, payload.category, payload.amount, payload.note, store_id=store_id)
