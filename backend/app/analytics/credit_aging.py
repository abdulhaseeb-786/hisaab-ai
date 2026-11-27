"""Credit & Customer Udhaar Intelligence Engine.
Requirement CRED-01, CRED-02, CRED-04.
Formulas:
- Customer balance: Sum(debit) - Sum(credit)
- Aging Buckets:
    - 0-30 days (Current)
    - 31-60 days (Overdue)
    - 61+ days (Severely Overdue)
- Default credit term: 30 days
- Safe Mark Score: Algorithmic rating 0 to 100 based on overdue ratios and payment history.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Customer, LedgerEntry, Store

def calculate_credit_summary(db: Session, store_id: int = 1) -> Dict[str, Any]:
    """Calculate comprehensive aging, customer balances, and Safe Mark credit rankings."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    store = db.query(Store).filter(Store.store_id == store_id).first()
    default_term = store.default_credit_term_days if store else 30

    customers = db.query(Customer).filter(Customer.store_id == store_id).all()

    total_current = 0.0
    total_overdue_30_60 = 0.0
    total_overdue_60_plus = 0.0
    total_receivables = 0.0

    customer_items = []

    for c in customers:
        entries = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.customer_id == c.customer_id)
            .order_by(LedgerEntry.timestamp.asc())
            .all()
        )

        total_deb = sum(e.debit for e in entries)
        total_cred = sum(e.credit for e in entries)
        balance = max(0.0, total_deb - total_cred)

        if balance <= 0.0:
            continue

        total_receivables += balance

        # Determine overdue amount based on due dates
        overdue_amt = 0.0
        max_days_past_due = 0

        # Unallocated credits offset oldest debits first (FIFO reconciliation)
        remaining_credit_to_apply = total_cred

        cust_current = 0.0
        cust_30_60 = 0.0
        cust_60_plus = 0.0

        for e in entries:
            if e.debit > 0:
                if remaining_credit_to_apply >= e.debit:
                    remaining_credit_to_apply -= e.debit
                else:
                    unpaid_debit = e.debit - remaining_credit_to_apply
                    remaining_credit_to_apply = 0.0

                    due_dt = e.due_date or (e.timestamp + timedelta(days=default_term))
                    if due_dt.tzinfo is not None:
                        due_dt = due_dt.replace(tzinfo=None)

                    days_past = (now - due_dt).days

                    if days_past > 0:
                        overdue_amt += unpaid_debit
                        max_days_past_due = max(max_days_past_due, days_past)

                        if days_past <= 30:
                            cust_30_60 += unpaid_debit
                        else:
                            cust_60_plus += unpaid_debit
                    else:
                        cust_current += unpaid_debit

        total_current += cust_current
        total_overdue_30_60 += cust_30_60
        total_overdue_60_plus += cust_60_plus

        # Safe Mark Score calculation
        # Baseline score starts at 100
        # Penalties: overdue fraction * 40 points, days overdue penalty
        overdue_fraction = (overdue_amt / balance) if balance > 0 else 0.0
        safe_mark = 100.0 - (overdue_fraction * 45.0) - (min(max_days_past_due, 45) * 0.8)
        safe_mark = max(10.0, min(100.0, safe_mark))

        risk_level = "low"
        if safe_mark < 50.0:
            risk_level = "high"
        elif safe_mark < 75.0:
            risk_level = "medium"

        # Update customer record
        c.safe_mark_score = round(safe_mark, 1)

        last_pay = [e for e in entries if e.credit > 0]
        last_pay_date = last_pay[-1].timestamp if last_pay else None

        customer_items.append({
            "customer_id": c.customer_id,
            "name": c.name,
            "phone": c.phone,
            "total_balance_pkr": round(balance, 2),
            "overdue_amount_pkr": round(overdue_amt, 2),
            "days_overdue": max_days_past_due,
            "credit_limit_pkr": c.credit_limit,
            "safe_mark_score": round(safe_mark, 1),
            "risk_level": risk_level,
            "avatar_url": None,
            "local_icon_url": "/static/images/icons/khata_ledger.svg",
            "last_payment_date": last_pay_date
        })

    # Sort customers by collection priority (overdue amount * days overdue)
    customer_items.sort(key=lambda x: (x["overdue_amount_pkr"] * (x["days_overdue"] + 1)), reverse=True)

    db.commit()

    return {
        "store_id": store_id,
        "as_of": now,
        "aging": {
            "current_0_30_days_pkr": round(total_current, 2),
            "overdue_31_60_days_pkr": round(total_overdue_30_60, 2),
            "overdue_61_plus_days_pkr": round(total_overdue_60_plus, 2),
            "total_outstanding_pkr": round(total_receivables, 2)
        },
        "total_customers_with_balance": len(customer_items),
        "total_overdue_customers": len([c for c in customer_items if c["overdue_amount_pkr"] > 0]),
        "top_defaulters": customer_items[:5],
        "customers": customer_items,
        "data_label": "Demo Data"
    }
