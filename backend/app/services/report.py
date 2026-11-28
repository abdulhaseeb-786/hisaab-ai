"""A business report a shopkeeper can hand to a bank or microfinance officer.

Lenders to small shops ask the same questions: how much do you sell, do you make a
profit after expenses, is it steady, who owes you, what do you owe, and do you keep
records. Every figure here is computed from the shop's own records with the same
functions the app uses; nothing is estimated except where the report says so.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.cash_book import NON_OPERATING_EXPENSES, cash_position
from app.analytics.credit_aging import calculate_credit_summary
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.kpi_calculator import _sales_totals
from app.analytics.payables import calculate_payables
from app.core.clock import store_now
from app.models import DaySession, Expense, LedgerEntry, Sale, Store, SupplierLedgerEntry

MONTHS = 6


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, 1)


def _month_row(db: Session, store_id: int, start: datetime, end: datetime, partial: bool) -> dict[str, Any]:
    t = _sales_totals(db, store_id, start, end)
    opex = float(
        db.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.store_id == store_id, Expense.date >= start, Expense.date < end,
                Expense.category.notin_(NON_OPERATING_EXPENSES)).scalar()
    )
    cash_sales = float(
        db.query(func.coalesce(func.sum(Sale.total), 0.0))
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.payment_type == "cash",
                Sale.timestamp >= start, Sale.timestamp < end).scalar()
    )
    days_trading = int(
        db.query(func.count(func.distinct(func.date(Sale.timestamp))))
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.timestamp >= start, Sale.timestamp < end).scalar()
    )
    revenue = t["revenue"]
    return {
        "month": start.strftime("%b %Y"),
        "start": start.date(),
        "is_partial": partial,
        "days_trading": days_trading,
        "revenue_pkr": round(revenue, 0),
        "gross_profit_pkr": round(t["profit"], 0),
        "gross_margin_pct": round(t["profit"] / revenue * 100, 1) if revenue else 0.0,
        "operating_expenses_pkr": round(opex, 0),
        "net_profit_pkr": round(t["profit"] - opex, 0),
        "cash_sales_pct": round(cash_sales / revenue * 100, 1) if revenue else 0.0,
        "average_daily_sales_pkr": round(revenue / days_trading, 0) if days_trading else 0.0,
        "bills": t["count"],
    }


def business_report(db: Session, store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    store = db.get(Store, store_id)
    first_sale = db.query(func.min(Sale.timestamp)).filter(Sale.store_id == store_id).scalar()

    this_month = _month_start(now.date())
    months = []
    for back in range(MONTHS, 0, -1):
        s = _add_months(this_month, -back)
        if first_sale and datetime.combine(_add_months(s, 1), datetime.min.time()) <= first_sale:
            continue
        months.append(_month_row(db, store_id, datetime.combine(s, datetime.min.time()),
                                 datetime.combine(_add_months(s, 1), datetime.min.time()), False))
    months.append(_month_row(db, store_id, datetime.combine(this_month, datetime.min.time()), now, True))
    full = [m for m in months if not m["is_partial"]]

    avg_rev = sum(m["revenue_pkr"] for m in full) / len(full) if full else 0.0
    avg_net = sum(m["net_profit_pkr"] for m in full) / len(full) if full else 0.0
    avg_margin = sum(m["gross_margin_pct"] for m in full) / len(full) if full else 0.0
    trend = None
    if len(full) >= 6:
        recent, earlier = sum(m["revenue_pkr"] for m in full[-3:]), sum(m["revenue_pkr"] for m in full[-6:-3])
        trend = round((recent - earlier) / earlier * 100, 1) if earlier else None
    profitable = sum(1 for m in full if m["net_profit_pkr"] > 0)

    credit = calculate_credit_summary(db, store_id, now)
    since90 = now - timedelta(days=90)
    given, collected = db.query(func.coalesce(func.sum(LedgerEntry.debit), 0.0), func.coalesce(func.sum(LedgerEntry.credit), 0.0)).filter(
        LedgerEntry.store_id == store_id, LedgerEntry.timestamp >= since90, LedgerEntry.timestamp <= now).one()
    outstanding = credit["aging"]["total_outstanding_pkr"]
    overdue = credit["aging"]["total_overdue_pkr"]

    payables = calculate_payables(db, store_id, horizon_days=7, now=now)
    billed, paid = db.query(func.coalesce(func.sum(SupplierLedgerEntry.credit), 0.0), func.coalesce(func.sum(SupplierLedgerEntry.debit), 0.0)).filter(
        SupplierLedgerEntry.store_id == store_id, SupplierLedgerEntry.timestamp >= since90, SupplierLedgerEntry.timestamp <= now).one()

    inventory = compute_inventory_health(db, store_id, now=now)
    stock_value = sum(i["stock_value_pkr"] for i in inventory)
    dead_value = sum(i["stock_value_pkr"] for i in inventory if i["is_dead_stock"])
    cash = cash_position(db, store_id, now)["cash_in_hand_pkr"]

    since30 = now.date() - timedelta(days=29)  # the last 30 days, today included
    closed = (db.query(DaySession).filter(DaySession.store_id == store_id, DaySession.business_date >= since30,
                                          DaySession.closed_at.isnot(None)).all())
    matched = sum(1 for s in closed if abs((s.closing_counted or 0) - (s.closing_expected or 0)) < 1)
    galla_diff = sum((s.closing_counted or 0) - (s.closing_expected or 0) for s in closed)

    monthly_supplier_bills = float(billed) / 3
    working_capital = cash + stock_value + outstanding - payables["total_payables_pkr"]

    strengths, cautions = [], []
    if full and profitable == len(full):
        strengths.append(f"Made a net profit in each of the last {len(full)} full months.")
    elif full:
        cautions.append(f"Net profit in {profitable} of the last {len(full)} full months.")
    if trend is not None and trend > 0:
        strengths.append(f"Sales grew {trend:.0f}% in the last 3 months compared with the 3 before.")
    elif trend is not None and trend < -5:
        cautions.append(f"Sales fell {abs(trend):.0f}% in the last 3 months compared with the 3 before.")
    if closed:
        strengths.append(f"Counted the cash drawer on {len(closed)} of the last 30 days; it matched the records on {matched}.")
    if payables["overdue_pkr"] <= 0:
        strengths.append("No supplier bill is overdue.")
    else:
        cautions.append(f"Rs {payables['overdue_pkr']:,.0f} of supplier bills are overdue.")
    if outstanding and overdue / outstanding > 0.4:
        cautions.append(f"{overdue / outstanding * 100:.0f}% of customer credit is overdue (Rs {overdue:,.0f}).")
    if given and float(collected) / float(given) >= 0.85:
        strengths.append(f"Collected {float(collected) / float(given) * 100:.0f}% as much credit as was given in the last 90 days.")
    if stock_value and dead_value / stock_value > 0.1:
        cautions.append(f"Rs {dead_value:,.0f} of stock has not sold in 30 days.")

    return {
        "generated_at": now,
        "store": {
            "name": store.name if store else "",
            "location": store.location if store else None,
            "owner_name": store.owner_name if store else None,
            "records_since": first_sale.date() if first_sale else None,
            "days_of_records": (now.date() - first_sale.date()).days + 1 if first_sale else 0,
        },
        "months": months,
        "summary": {
            "average_monthly_sales_pkr": round(avg_rev, 0),
            "average_monthly_net_profit_pkr": round(avg_net, 0),
            "average_gross_margin_pct": round(avg_margin, 1),
            "sales_trend_3m_pct": trend,
            "profitable_months": profitable,
            "full_months": len(full),
        },
        "position": {
            "cash_in_hand_pkr": round(cash, 0),
            "stock_value_at_cost_pkr": round(stock_value, 0),
            "customer_credit_outstanding_pkr": round(outstanding, 0),
            "supplier_bills_outstanding_pkr": round(payables["total_payables_pkr"], 0),
            "working_capital_pkr": round(working_capital, 0),
        },
        "credit": {
            "outstanding_pkr": round(outstanding, 0),
            "overdue_pkr": round(overdue, 0),
            "overdue_pct": round(overdue / outstanding * 100, 1) if outstanding else 0.0,
            "customers_with_balance": credit["total_customers_with_balance"],
            "given_90d_pkr": round(float(given), 0),
            "collected_90d_pkr": round(float(collected), 0),
            "collection_ratio_pct": round(float(collected) / float(given) * 100, 1) if given else None,
        },
        "suppliers": {
            "outstanding_pkr": round(payables["total_payables_pkr"], 0),
            "overdue_pkr": round(payables["overdue_pkr"], 0),
            "billed_90d_pkr": round(float(billed), 0),
            "paid_90d_pkr": round(float(paid), 0),
            "average_monthly_purchases_pkr": round(monthly_supplier_bills, 0),
        },
        "record_keeping": {
            "days_closed_last_30": len(closed),
            "days_galla_matched": matched,
            "galla_difference_30d_pkr": round(galla_diff, 0),
        },
        "strengths": strengths,
        "cautions": cautions,
        "method_notes": [
            "Sales and gross profit come from every recorded bill; cost is the price paid for each item when it was sold.",
            "Net profit = gross profit minus rent, electricity, salaries, transport and other running costs. "
            "Money the owner took home and bank deposits are not counted as costs.",
            "Working capital = cash + stock at cost + customer credit - supplier bills.",
            "The current month is shown separately because it is not complete.",
        ],
    }
