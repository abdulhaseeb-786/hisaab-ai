"""7-day cash outlook: will the drawer have enough cash to pay what is due?

Day by day, starting tomorrow, from today's real cash in hand:

* Cash sales in: the average cash sales of the same weekday over the last 4 weeks.
* Khata repayments in: the average daily repayment over the last 28 days.
* Supplier payments out: open invoices on their due dates (overdue ones on day 1).
* Expenses out: recurring expenses repeated on the schedule seen in the records
  (monthly bills on the same date, weekly costs on the same weekday, daily costs averaged).
  Bank deposits are transfers, not spending, and are left out.

Every assumption is returned with the numbers so the screen can show it.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from app.analytics.cash_book import cash_position, daily_cash_flows
from app.analytics.payables import open_supplier_invoices
from app.core.clock import store_now
from app.models import Expense, Supplier

SAFETY_CASH_PKR = 20_000.0
EXPENSE_LABELS = {
    "rent": "Shop rent",
    "salaries": "Salaries",
    "electricity": "Electricity bill",
    "transport": "Transport",
    "general": "Small daily costs",
    "owner_drawings": "Owner household money",
}


def _expense_schedule(db: Session, store_id: int, today: date) -> list[dict[str, Any]]:
    """Infer how each expense category recurs from the last ~3 months of records."""
    since = datetime.combine(today - timedelta(days=95), datetime.min.time())
    by_cat: dict[str, list[Expense]] = defaultdict(list)
    for e in db.query(Expense).filter(Expense.store_id == store_id, Expense.date >= since).order_by(Expense.date):
        if e.category != "bank_deposit":
            by_cat[e.category].append(e)

    schedule = []
    for cat, items in by_cat.items():
        days = sorted({e.date.date() for e in items})
        gaps = sorted((b - a).days for a, b in zip(days, days[1:]))
        median_gap = gaps[len(gaps) // 2] if gaps else 30
        if median_gap <= 2:  # happens most days
            daily_total = sum(e.amount for e in items if e.date.date() >= today - timedelta(days=28))
            schedule.append({"category": cat, "rule": "daily", "amount": round(daily_total / 28, 0)})
        elif 6 <= median_gap <= 8:
            schedule.append({"category": cat, "rule": "weekly", "weekday": items[-1].date.weekday(),
                             "amount": round(mean(e.amount for e in items[-4:]), 0)})
        else:
            schedule.append({"category": cat, "rule": "monthly", "day_of_month": items[-1].date.day,
                             "amount": round(items[-1].amount, 0)})
    return schedule


def calculate_cash_outlook(db: Session, store_id: int = 1, days_ahead: int = 7, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    today = now.date()
    position = cash_position(db, store_id, now)

    # Inflow assumptions from the last four complete weeks.
    hist_start, hist_end = today - timedelta(days=28), today - timedelta(days=1)
    flows = daily_cash_flows(db, store_id, hist_start, hist_end)
    sales_by_weekday: dict[int, list[float]] = defaultdict(list)
    for i in range(28):
        d = hist_start + timedelta(days=i)
        sales_by_weekday[d.weekday()].append(flows.get(d, {}).get("cash_sales", 0.0))
    avg_wasooli = sum(flows.get(hist_start + timedelta(days=i), {}).get("wasooli", 0.0) for i in range(28)) / 28

    schedule = _expense_schedule(db, store_id, today)
    invoices = open_supplier_invoices(db, store_id, now)
    supplier_names = {s.supplier_id: s.name for s in db.query(Supplier).filter(Supplier.store_id == store_id)}

    days_out = []
    balance = position["cash_in_hand_pkr"]
    lowest = (balance, today)
    for i in range(1, days_ahead + 1):
        d = today + timedelta(days=i)
        sales_in = round(mean(sales_by_weekday[d.weekday()]) if sales_by_weekday[d.weekday()] else 0.0, 0)
        wasooli_in = round(avg_wasooli, 0)

        payments = []
        for supplier_id, items in invoices.items():
            for inv in items:
                due_day = inv["due_date"].date()
                if due_day == d or (i == 1 and due_day <= today):
                    payments.append({
                        "supplier_id": supplier_id,
                        "supplier_name": supplier_names.get(supplier_id, f"Supplier {supplier_id}"),
                        "reference": inv["reference"],
                        "amount_pkr": inv["open_amount_pkr"],
                        "was_overdue": due_day <= today,
                    })
        expenses = []
        for rule in schedule:
            hit = (
                rule["rule"] == "daily"
                or (rule["rule"] == "weekly" and d.weekday() == rule["weekday"])
                or (rule["rule"] == "monthly" and d.day == rule["day_of_month"])
            )
            if hit and rule["amount"] > 0:
                expenses.append({
                    "category": rule["category"],
                    "label": EXPENSE_LABELS.get(rule["category"], rule["category"].replace("_", " ").title()),
                    "amount_pkr": rule["amount"],
                })

        supplier_out = round(sum(p["amount_pkr"] for p in payments), 0)
        expenses_out = round(sum(e["amount_pkr"] for e in expenses), 0)
        opening = balance
        balance = round(balance + sales_in + wasooli_in - supplier_out - expenses_out, 0)
        if balance < lowest[0]:
            lowest = (balance, d)
        days_out.append({
            "date": d,
            "opening_cash_pkr": opening,
            "cash_sales_in_pkr": sales_in,
            "wasooli_in_pkr": wasooli_in,
            "supplier_payments_out_pkr": supplier_out,
            "expenses_out_pkr": expenses_out,
            "closing_cash_pkr": balance,
            "supplier_payments": payments,
            "expenses": expenses,
        })

    total_in_sales = sum(x["cash_sales_in_pkr"] for x in days_out)
    total_in_wasooli = sum(x["wasooli_in_pkr"] for x in days_out)
    total_out_suppliers = sum(x["supplier_payments_out_pkr"] for x in days_out)
    total_out_expenses = sum(x["expenses_out_pkr"] for x in days_out)
    shortfall_day = next((x for x in days_out if x["closing_cash_pkr"] < SAFETY_CASH_PKR), None)

    assumptions = [
        f"Starts from today's cash in hand (Rs {position['cash_in_hand_pkr']:,.0f}), worked out from all recorded sales, repayments, payments and expenses.",
        "Cash sales each day = average cash sales of the same weekday in the last 4 weeks.",
        f"Khata repayments = last 28 days' average, Rs {avg_wasooli:,.0f} a day.",
        "Supplier invoices are paid on their due dates; overdue ones on the first day.",
        "Recurring expenses repeat on the same schedule as in the records. Bank deposits are not counted.",
        f"A day is flagged when cash would drop below Rs {SAFETY_CASH_PKR:,.0f}.",
    ]

    return {
        "store_id": store_id,
        "as_of": now,
        "horizon_days": days_ahead,
        "opening_cash_pkr": position["cash_in_hand_pkr"],
        "cash_position": position,
        "projected_inflows": {
            "cash_sales_pkr": round(total_in_sales, 0),
            "debt_collections_wasooli_pkr": round(total_in_wasooli, 0),
            "total_inflows_pkr": round(total_in_sales + total_in_wasooli, 0),
        },
        "projected_outflows": {
            "supplier_payables_due_pkr": round(total_out_suppliers, 0),
            "operating_expenses_pkr": round(total_out_expenses, 0),
            "total_outflows_pkr": round(total_out_suppliers + total_out_expenses, 0),
        },
        "projected_closing_cash_pkr": days_out[-1]["closing_cash_pkr"] if days_out else position["cash_in_hand_pkr"],
        "lowest_cash_pkr": lowest[0],
        "lowest_cash_date": lowest[1],
        "safety_cash_pkr": SAFETY_CASH_PKR,
        "shortfall_warning": shortfall_day is not None,
        "shortfall_date": shortfall_day["date"] if shortfall_day else None,
        "shortfall_risk_pkr": round(max(0.0, SAFETY_CASH_PKR - lowest[0]), 0) if shortfall_day else 0.0,
        "days": days_out,
        "expense_schedule": schedule,
        "assumptions": assumptions,
    }
