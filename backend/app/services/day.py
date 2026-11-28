"""The day loop: open the shop with a galla count, close it with another.

Opening: the shopkeeper counts the cash. If it differs from what the records say, the
difference is booked (CashAdjustment) so the cash book always matches the real drawer.

Closing: count again. HisaabAI shows the day in one screen: sales, udhaar given, money
collected, bills paid, expenses, gross profit, and the galla difference. Then it lists
what tomorrow holds: bills due, distributors visiting, customers to remind.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.cash_book import CASH, NON_OPERATING_EXPENSES, cash_position, paid_in_cash
from app.analytics.credit_aging import calculate_credit_summary
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.payables import open_supplier_invoices
from app.core.clock import store_now
from app.models import CashAdjustment, DaySession, Expense, LedgerEntry, Sale, SaleLine, Supplier, SupplierLedgerEntry

WEEKDAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class DayError(ValueError):
    """A day action that does not fit the current state (e.g. closing a day never opened)."""


def _session_for(db: Session, store_id: int, day: date) -> DaySession | None:
    return (
        db.query(DaySession)
        .filter(DaySession.store_id == store_id, DaySession.business_date == day)
        .order_by(DaySession.session_id.desc())
        .first()
    )


def _sum(q) -> float:
    return round(float(q.scalar() or 0.0), 2)


def day_figures(db: Session, store_id: int, start: datetime, end: datetime) -> dict[str, Any]:
    """Everything that happened between two moments, in shopkeeper terms."""
    sales = (
        db.query(func.coalesce(func.sum(SaleLine.qty * SaleLine.unit_price - SaleLine.discount), 0.0),
                 func.coalesce(func.sum(SaleLine.qty * SaleLine.unit_cost_snapshot), 0.0),
                 func.count(func.distinct(Sale.sale_id)))
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.timestamp >= start, Sale.timestamp < end)
        .one()
    )
    revenue, cogs, bills = float(sales[0]), float(sales[1]), int(sales[2])
    cash_sales = _sum(db.query(func.sum(Sale.total)).filter(
        Sale.store_id == store_id, Sale.payment_type == "cash", Sale.timestamp >= start, Sale.timestamp < end))
    udhaar_given = _sum(db.query(func.sum(LedgerEntry.debit)).filter(
        LedgerEntry.store_id == store_id, LedgerEntry.timestamp >= start, LedgerEntry.timestamp < end))
    wasooli_cash = _sum(db.query(func.sum(LedgerEntry.credit)).filter(
        LedgerEntry.store_id == store_id, LedgerEntry.timestamp >= start, LedgerEntry.timestamp < end,
        paid_in_cash(LedgerEntry.method)))
    wasooli_digital = _sum(db.query(func.sum(LedgerEntry.credit)).filter(
        LedgerEntry.store_id == store_id, LedgerEntry.timestamp >= start, LedgerEntry.timestamp < end,
        ~paid_in_cash(LedgerEntry.method)))
    supplier_paid = _sum(db.query(func.sum(SupplierLedgerEntry.debit)).filter(
        SupplierLedgerEntry.store_id == store_id, SupplierLedgerEntry.timestamp >= start,
        SupplierLedgerEntry.timestamp < end, paid_in_cash(SupplierLedgerEntry.method)))
    expenses = _sum(db.query(func.sum(Expense.amount)).filter(
        Expense.store_id == store_id, Expense.date >= start, Expense.date < end,
        Expense.category.notin_(NON_OPERATING_EXPENSES)))
    withdrawals = _sum(db.query(func.sum(Expense.amount)).filter(
        Expense.store_id == store_id, Expense.date >= start, Expense.date < end,
        Expense.category.in_(NON_OPERATING_EXPENSES)))
    return {
        "bills": bills,
        "sales_pkr": round(revenue, 2),
        "cash_sales_pkr": cash_sales,
        "udhaar_given_pkr": udhaar_given,
        "wasooli_cash_pkr": wasooli_cash,
        "wasooli_digital_pkr": wasooli_digital,
        "supplier_payments_pkr": supplier_paid,
        "expenses_pkr": expenses,
        "withdrawals_pkr": withdrawals,
        "gross_profit_pkr": round(revenue - cogs, 2),
    }


def _tomorrow(db: Session, store_id: int, now: datetime) -> dict[str, Any]:
    tomorrow = now.date() + timedelta(days=1)
    end_of_tomorrow = datetime.combine(tomorrow, time.max)
    names = {s.supplier_id: s for s in db.query(Supplier).filter(Supplier.store_id == store_id)}
    bills = []
    for supplier_id, invoices in open_supplier_invoices(db, store_id, now).items():
        due = sum(i["open_amount_pkr"] for i in invoices if i["due_date"] <= end_of_tomorrow)
        if due > 0:
            bills.append({"supplier_id": supplier_id, "supplier_name": names[supplier_id].name, "amount_pkr": round(due, 2)})
    visits = [
        {"supplier_id": s.supplier_id, "supplier_name": s.name}
        for s in names.values()
        if str(tomorrow.weekday()) in (s.visit_days or "").split(",")
    ]
    credit = calculate_credit_summary(db, store_id, now)
    remind = [
        {"customer_id": c["customer_id"], "name": c["name"], "overdue_pkr": c["overdue_amount_pkr"], "days_overdue": c["days_overdue"]}
        for c in credit["top_defaulters"][:3]
    ]
    low = sum(1 for i in compute_inventory_health(db, store_id, now=now) if i["stockout_risk"] in ("critical", "high"))
    return {
        "date": tomorrow,
        "weekday": WEEKDAYS_EN[tomorrow.weekday()],
        "bills_due": sorted(bills, key=lambda b: -b["amount_pkr"]),
        "bills_due_total_pkr": round(sum(b["amount_pkr"] for b in bills), 2),
        "distributor_visits": visits,
        "customers_to_remind": remind,
        "items_running_low": low,
    }


def _session_dict(s: DaySession | None) -> dict[str, Any] | None:
    if not s:
        return None
    return {
        "session_id": s.session_id,
        "business_date": s.business_date,
        "opened_at": s.opened_at,
        "opening_expected_pkr": s.opening_expected,
        "opening_counted_pkr": s.opening_counted,
        "closed_at": s.closed_at,
        "closing_expected_pkr": s.closing_expected,
        "closing_counted_pkr": s.closing_counted,
        "closing_difference_pkr": round(s.closing_counted - s.closing_expected, 2) if s.closed_at else None,
        "note": s.note,
    }


def day_status(db: Session, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    session = _session_for(db, store_id, now.date())
    state = "not_opened" if not session else "closed" if session.closed_at else "open"
    start = session.opened_at if session else datetime.combine(now.date(), time.min)
    yesterday = _session_for(db, store_id, now.date() - timedelta(days=1))
    return {
        "state": state,
        "business_date": now.date(),
        "now": now,
        "session": _session_dict(session),
        "cash_in_drawer_expected_pkr": cash_position(db, store_id, now)["cash_in_hand_pkr"],
        "today": day_figures(db, store_id, datetime.combine(now.date(), time.min), now),
        "since_open_start": start,
        "yesterday": _session_dict(yesterday),
    }


def _book_difference(db: Session, store_id: int, session: DaySession, now: datetime, diff: float, when: str) -> None:
    if abs(diff) < 0.5:
        return
    db.add(CashAdjustment(
        store_id=store_id, timestamp=now, amount=round(diff, 2), session_id=session.session_id,
        reason=f"Galla {'short' if diff < 0 else 'extra'} at {when}",
    ))


def open_day(db: Session, counted_cash: float, note: str | None = None, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    existing = _session_for(db, store_id, now.date())
    if existing and not existing.closed_at:
        raise DayError("The shop is already open today.")
    if counted_cash < 0:
        raise DayError("Counted cash cannot be negative.")
    expected = cash_position(db, store_id, now)["cash_in_hand_pkr"]
    session = DaySession(store_id=store_id, business_date=now.date(), opened_at=now,
                         opening_expected=expected, opening_counted=counted_cash, note=note)
    db.add(session)
    db.flush()
    _book_difference(db, store_id, session, now, counted_cash - expected, "opening")
    db.commit()
    return {**day_status(db, store_id, now), "difference_pkr": round(counted_cash - expected, 2)}


def close_day(db: Session, counted_cash: float, note: str | None = None, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    session = _session_for(db, store_id, now.date())
    if not session:
        raise DayError("The shop was not opened today. Open the day first.")
    if session.closed_at:
        raise DayError("Today is already closed.")
    if counted_cash < 0:
        raise DayError("Counted cash cannot be negative.")
    expected = cash_position(db, store_id, now)["cash_in_hand_pkr"]
    session.closed_at = now
    session.closing_expected = expected
    session.closing_counted = counted_cash
    if note:
        session.note = note
    _book_difference(db, store_id, session, now, counted_cash - expected, "closing")
    db.commit()
    figures = day_figures(db, store_id, session.opened_at, now)
    return {
        "session": _session_dict(session),
        "difference_pkr": round(counted_cash - expected, 2),
        "figures": figures,
        "tomorrow": _tomorrow(db, store_id, now),
    }


def day_history(db: Session, store_id: int = 1, days: int = 14, now: datetime | None = None) -> list[dict[str, Any]]:
    now = now or store_now()
    since = now.date() - timedelta(days=days)
    out = []
    for s in (
        db.query(DaySession)
        .filter(DaySession.store_id == store_id, DaySession.business_date >= since)
        .order_by(DaySession.business_date.desc())
    ):
        end = s.closed_at or now
        out.append({**_session_dict(s), "figures": day_figures(db, store_id, s.opened_at, end)})
    return out


EXPENSE_CATEGORIES = {"rent", "electricity", "salaries", "transport", "general", "owner_drawings", "bank_deposit"}


def record_expense(db: Session, category: str, amount: float, note: str | None, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    if category not in EXPENSE_CATEGORIES:
        raise DayError(f"Unknown expense type '{category}'.")
    if amount <= 0:
        raise DayError("Amount must be more than zero.")
    cash = cash_position(db, store_id, now)["cash_in_hand_pkr"]
    if amount > cash + 0.01:
        raise DayError(f"Only Rs {cash:,.0f} is in the galla.")
    e = Expense(store_id=store_id, date=now, category=category, amount=round(amount, 2), description=note or category)
    db.add(e)
    db.commit()
    return {"expense_id": e.expense_id, "category": category, "amount_pkr": e.amount, "note": e.description,
            "cash_in_drawer_pkr": round(cash - amount, 2), "method": CASH}
