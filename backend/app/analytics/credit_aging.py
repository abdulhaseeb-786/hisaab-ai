"""Customer khata (udhaar): balances, aging and a Safe Mark score.

* Balance = sum of credit purchases - sum of repayments (ledger debits - credits).
* Repayments clear the oldest purchases first (FIFO), so we know which purchases are
  still unpaid.
* Each unpaid purchase is due on its due date, or `default_credit_term_days` after the
  purchase when no due date was recorded.
* Aging buckets use days past due: not yet due, 1-30, 31-60, 61+ days overdue.
* Safe Mark score (0-100) starts at 100 and loses points for clear, listed reasons, so
  the shopkeeper can see why a customer is risky. It is a rule, not a credit bureau score.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.clock import store_now
from app.models import Customer, LedgerEntry, Store


def _safe_mark(balance: float, overdue: float, days_overdue: int, credit_limit: float,
               days_since_payment: int | None) -> tuple[float, list[dict[str, Any]]]:
    factors: list[dict[str, Any]] = []
    score = 100.0
    if balance > 0 and overdue > 0:
        share = overdue / balance
        pts = round(40 * share, 1)
        score -= pts
        factors.append({"reason": f"{share * 100:.0f}% of the balance is overdue", "points": -pts})
    if days_overdue > 0:
        pts = round(0.5 * min(days_overdue, 60), 1)
        score -= pts
        factors.append({"reason": f"Oldest unpaid bill is {days_overdue} days past due", "points": -pts})
    if credit_limit and balance > credit_limit:
        score -= 15
        factors.append({"reason": f"Balance is above the Rs {credit_limit:,.0f} limit", "points": -15})
    if balance > 0 and (days_since_payment is None or days_since_payment > 45):
        score -= 10
        when = "never" if days_since_payment is None else f"{days_since_payment} days ago"
        factors.append({"reason": f"Last payment was {when}", "points": -10})
    return max(0.0, min(100.0, round(score, 1))), factors


def _risk_level(score: float) -> str:
    return "high" if score < 50 else "medium" if score < 75 else "low"


def _analyse_customer(entries: list[LedgerEntry], default_term: int, now: datetime) -> dict[str, Any]:
    total_debit = sum(e.debit for e in entries)
    total_credit = sum(e.credit for e in entries)
    balance = max(0.0, total_debit - total_credit)

    buckets = {"not_due": 0.0, "overdue_1_30": 0.0, "overdue_31_60": 0.0, "overdue_61_plus": 0.0}
    overdue = 0.0
    max_days = 0
    remaining_credit = total_credit
    for e in sorted(entries, key=lambda x: x.timestamp):
        if e.debit <= 0:
            continue
        if remaining_credit >= e.debit:
            remaining_credit -= e.debit
            continue
        unpaid = e.debit - remaining_credit
        remaining_credit = 0.0
        due = e.due_date or (e.timestamp + timedelta(days=default_term))
        days_past = (now - due).days
        if days_past <= 0:
            buckets["not_due"] += unpaid
        else:
            overdue += unpaid
            max_days = max(max_days, days_past)
            key = "overdue_1_30" if days_past <= 30 else "overdue_31_60" if days_past <= 60 else "overdue_61_plus"
            buckets[key] += unpaid

    payments = [e for e in entries if e.credit > 0]
    purchases = [e for e in entries if e.debit > 0]
    last_payment = max((e.timestamp for e in payments), default=None)
    last_purchase = max((e.timestamp for e in purchases), default=None)
    return {
        "balance": balance,
        "overdue": overdue,
        "max_days": max_days,
        "buckets": buckets,
        "last_payment": last_payment,
        "last_purchase": last_purchase,
    }


def calculate_credit_summary(db: Session, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    store = db.get(Store, store_id)
    default_term = store.default_credit_term_days if store else 30

    entries_by_customer: dict[int, list[LedgerEntry]] = defaultdict(list)
    for e in db.query(LedgerEntry).filter(LedgerEntry.store_id == store_id, LedgerEntry.timestamp <= now):
        entries_by_customer[e.customer_id].append(e)

    totals = {"not_due": 0.0, "overdue_1_30": 0.0, "overdue_31_60": 0.0, "overdue_61_plus": 0.0}
    customers_out = []
    for c in db.query(Customer).filter(Customer.store_id == store_id).order_by(Customer.customer_id):
        info = _analyse_customer(entries_by_customer.get(c.customer_id, []), default_term, now)
        if info["balance"] <= 0.5:
            continue
        for k in totals:
            totals[k] += info["buckets"][k]
        days_since_payment = (now - info["last_payment"]).days if info["last_payment"] else None
        score, factors = _safe_mark(info["balance"], info["overdue"], info["max_days"], c.credit_limit, days_since_payment)
        customers_out.append({
            "customer_id": c.customer_id,
            "name": c.name,
            "phone": c.phone,
            "total_balance_pkr": round(info["balance"], 2),
            "overdue_amount_pkr": round(info["overdue"], 2),
            "days_overdue": info["max_days"],
            "credit_limit_pkr": c.credit_limit,
            "over_limit": bool(c.credit_limit and info["balance"] > c.credit_limit),
            "safe_mark_score": score,
            "score_factors": factors,
            "risk_level": _risk_level(score),
            "last_payment_date": info["last_payment"],
            "days_since_last_payment": days_since_payment,
            "last_purchase_date": info["last_purchase"],
            "aging": {k: round(v, 2) for k, v in info["buckets"].items()},
        })

    # Collection priority: overdue money weighted by how late it is.
    customers_out.sort(key=lambda x: x["overdue_amount_pkr"] * (1 + x["days_overdue"] / 30), reverse=True)
    total = sum(c["total_balance_pkr"] for c in customers_out)
    overdue_total = sum(c["overdue_amount_pkr"] for c in customers_out)
    return {
        "store_id": store_id,
        "as_of": now,
        "default_credit_term_days": default_term,
        "aging": {
            "not_due_pkr": round(totals["not_due"], 2),
            "overdue_1_30_days_pkr": round(totals["overdue_1_30"], 2),
            "overdue_31_60_days_pkr": round(totals["overdue_31_60"], 2),
            "overdue_61_plus_days_pkr": round(totals["overdue_61_plus"], 2),
            "total_outstanding_pkr": round(total, 2),
            "total_overdue_pkr": round(overdue_total, 2),
        },
        "total_customers_with_balance": len(customers_out),
        "total_overdue_customers": sum(1 for c in customers_out if c["overdue_amount_pkr"] > 0),
        "top_defaulters": [c for c in customers_out if c["overdue_amount_pkr"] > 0][:5],
        "customers": customers_out,
    }


def customer_ledger(db: Session, customer_id: int, store_id: int = 1, now: datetime | None = None) -> dict[str, Any] | None:
    """One customer's khata page: every entry with a running balance, plus the summary."""
    now = now or store_now()
    customer = db.get(Customer, customer_id)
    if not customer or customer.store_id != store_id:
        return None
    summary = next(
        (c for c in calculate_credit_summary(db, store_id, now)["customers"] if c["customer_id"] == customer_id),
        None,
    )
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.customer_id == customer_id, LedgerEntry.timestamp <= now)
        .order_by(LedgerEntry.timestamp, LedgerEntry.entry_id)
        .all()
    )
    running = 0.0
    lines = []
    for e in entries:
        running += e.debit - e.credit
        lines.append({
            "entry_id": e.entry_id,
            "timestamp": e.timestamp,
            "kind": "purchase" if e.debit > 0 else "payment",
            "amount_pkr": round(e.debit or e.credit, 2),
            "due_date": e.due_date,
            "description": e.description,
            "running_balance_pkr": round(running, 2),
        })
    return {
        "customer_id": customer.customer_id,
        "name": customer.name,
        "phone": customer.phone,
        "credit_limit_pkr": customer.credit_limit,
        "summary": summary,
        "entries": lines[-60:][::-1],  # newest first, last 60 entries
        "total_entries": len(lines),
    }
