"""Cash book: the cash in the drawer, derived from records (never typed in by hand).

cash now = opening cash on the opening date
         + cash sales + khata repayments (wasooli)
         - supplier payments - expenses (incl. owner household money and bank deposits)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.clock import store_now
from app.models import Expense, LedgerEntry, Sale, Store, SupplierLedgerEntry

NON_OPERATING_EXPENSES = {"owner_drawings", "bank_deposit"}


def _sum(query) -> float:
    return float(query.scalar() or 0.0)


def cash_position(db: Session, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    store = db.get(Store, store_id)
    opening = store.opening_cash_pkr if store else 0.0
    since = store.opening_cash_date if store and store.opening_cash_date else datetime(1970, 1, 1)

    cash_sales = _sum(db.query(func.sum(Sale.total)).filter(
        Sale.store_id == store_id, Sale.payment_type == "cash", Sale.status == "completed",
        Sale.timestamp >= since, Sale.timestamp <= now))
    wasooli = _sum(db.query(func.sum(LedgerEntry.credit)).filter(
        LedgerEntry.store_id == store_id, LedgerEntry.timestamp >= since, LedgerEntry.timestamp <= now))
    supplier_paid = _sum(db.query(func.sum(SupplierLedgerEntry.debit)).filter(
        SupplierLedgerEntry.store_id == store_id, SupplierLedgerEntry.timestamp >= since,
        SupplierLedgerEntry.timestamp <= now))
    expenses = _sum(db.query(func.sum(Expense.amount)).filter(
        Expense.store_id == store_id, Expense.date >= since, Expense.date <= now))

    return {
        "as_of": now,
        "opening_cash_pkr": round(opening, 2),
        "opening_cash_date": since,
        "cash_sales_pkr": round(cash_sales, 2),
        "wasooli_pkr": round(wasooli, 2),
        "supplier_payments_pkr": round(supplier_paid, 2),
        "expenses_pkr": round(expenses, 2),
        "cash_in_hand_pkr": round(opening + cash_sales + wasooli - supplier_paid - expenses, 2),
    }


def daily_cash_flows(db: Session, store_id: int, start: date, end: date) -> dict[date, dict[str, float]]:
    """Per-day cash in and out between two dates (inclusive), used for averages."""
    out: dict[date, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    lo, hi = datetime.combine(start, datetime.min.time()), datetime.combine(end + timedelta(days=1), datetime.min.time())
    for ts, total in db.query(Sale.timestamp, Sale.total).filter(
            Sale.store_id == store_id, Sale.payment_type == "cash", Sale.status == "completed",
            Sale.timestamp >= lo, Sale.timestamp < hi):
        out[ts.date()]["cash_sales"] += total
    for ts, credit in db.query(LedgerEntry.timestamp, LedgerEntry.credit).filter(
            LedgerEntry.store_id == store_id, LedgerEntry.credit > 0,
            LedgerEntry.timestamp >= lo, LedgerEntry.timestamp < hi):
        out[ts.date()]["wasooli"] += credit
    return out
