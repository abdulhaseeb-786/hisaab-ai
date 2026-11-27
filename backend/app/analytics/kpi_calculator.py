"""Store KPIs for a period, compared with the period just before it.

* Revenue = sum(qty x unit price - line discount) of completed sales.
* Gross profit = revenue - COGS, where COGS uses the cost snapshot stored on each sale
  line. It is not net profit: rent, salaries and bills are not deducted.
* Inventory value = stock x latest cost price.
* Receivables, overdue, payables and cash come from the same functions the khata,
  payables and cash screens use, so every screen shows the same number.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.cash_book import NON_OPERATING_EXPENSES, cash_position
from app.analytics.credit_aging import calculate_credit_summary
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.payables import calculate_payables
from app.core.clock import start_of_day, store_now
from app.models import Expense, Sale, SaleLine

PERIOD_DAYS = {"today": 1, "7d": 7, "30d": 30, "90d": 90}


def _period_bounds(period: str, now: datetime) -> tuple[datetime, datetime, datetime]:
    """(start, end, previous_start) for the period ending now."""
    if period == "today":
        start = start_of_day(now.date())
        # Compare with the same hours yesterday.
        return start, now, start - timedelta(days=1)
    days = PERIOD_DAYS.get(period, 30)
    start = now - timedelta(days=days)
    return start, now, start - timedelta(days=days)


def _sales_totals(db: Session, store_id: int, start: datetime, end: datetime) -> dict[str, float]:
    row = (
        db.query(
            func.coalesce(func.sum(SaleLine.qty * SaleLine.unit_price - SaleLine.discount), 0.0),
            func.coalesce(func.sum(SaleLine.qty * SaleLine.unit_cost_snapshot), 0.0),
            func.count(func.distinct(Sale.sale_id)),
        )
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.timestamp >= start, Sale.timestamp < end)
        .one()
    )
    revenue, cogs, count = float(row[0]), float(row[1]), int(row[2])
    return {"revenue": revenue, "cogs": cogs, "profit": revenue - cogs, "count": count}


def _change_pct(current: float, previous: float) -> float | None:
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


def calculate_kpis(db: Session, store_id: int = 1, period: str = "30d", now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    if period not in PERIOD_DAYS:
        period = "30d"
    start, end, prev_start = _period_bounds(period, now)
    prev_end = start if period != "today" else now - timedelta(days=1)

    cur = _sales_totals(db, store_id, start, end)
    prev = _sales_totals(db, store_id, prev_start, prev_end)

    inventory = compute_inventory_health(db, store_id=store_id, now=now)
    credit = calculate_credit_summary(db, store_id=store_id, now=now)
    payables = calculate_payables(db, store_id=store_id, horizon_days=7, now=now)
    cash = cash_position(db, store_id=store_id, now=now)

    operating_expenses = float(
        db.query(func.coalesce(func.sum(Expense.amount), 0.0))
        .filter(Expense.store_id == store_id, Expense.date >= start, Expense.date < end,
                Expense.category.notin_(NON_OPERATING_EXPENSES))
        .scalar()
    )

    # Daily revenue series for a sparkline (up to 90 points).
    series_start = start_of_day((now - timedelta(days=min(PERIOD_DAYS[period], 90) - 1)).date()) if period != "today" else start_of_day(now.date() - timedelta(days=13))
    daily: dict[str, float] = defaultdict(float)
    for ts, qty, price, disc in (
        db.query(Sale.timestamp, SaleLine.qty, SaleLine.unit_price, SaleLine.discount)
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.timestamp >= series_start, Sale.timestamp <= now)
    ):
        daily[ts.date().isoformat()] += qty * price - disc
    n_days = (now.date() - series_start.date()).days + 1
    series = [
        {"date": (series_start.date() + timedelta(days=i)).isoformat(),
         "revenue_pkr": round(daily.get((series_start.date() + timedelta(days=i)).isoformat(), 0.0), 0)}
        for i in range(n_days)
    ]

    dead = [i for i in inventory if i["is_dead_stock"]]
    at_risk = [i for i in inventory if i["stockout_risk"] in ("critical", "high")]
    margin_pct = cur["profit"] / cur["revenue"] * 100 if cur["revenue"] else 0.0

    return {
        "period": period,
        "period_start": start,
        "period_end": end,
        "revenue_pkr": round(cur["revenue"], 2),
        "cogs_pkr": round(cur["cogs"], 2),
        "gross_profit_pkr": round(cur["profit"], 2),
        "gross_margin_pct": round(margin_pct, 2),
        "sales_count": cur["count"],
        "average_basket_pkr": round(cur["revenue"] / cur["count"], 0) if cur["count"] else 0.0,
        "operating_expenses_pkr": round(operating_expenses, 2),
        "previous_revenue_pkr": round(prev["revenue"], 2),
        "previous_gross_profit_pkr": round(prev["profit"], 2),
        "revenue_change_pct": _change_pct(cur["revenue"], prev["revenue"]),
        "gross_profit_change_pct": _change_pct(cur["profit"], prev["profit"]),
        "inventory_value_at_cost_pkr": round(sum(i["stock_value_pkr"] for i in inventory), 2),
        "products_at_risk_count": len(at_risk),
        "out_of_stock_count": sum(1 for i in inventory if i["is_out_of_stock"] and i["average_daily_demand"]),
        "out_of_stock_on_order_count": sum(
            1 for i in inventory if i["is_out_of_stock"] and i["average_daily_demand"] and i["pending_receipts"] > 0
        ),
        "dead_stock_value_pkr": round(sum(i["stock_value_pkr"] for i in dead), 2),
        "dead_stock_count": len(dead),
        "receivables_outstanding_pkr": credit["aging"]["total_outstanding_pkr"],
        "overdue_receivables_pkr": credit["aging"]["total_overdue_pkr"],
        "overdue_customers_count": credit["total_overdue_customers"],
        "payables_total_pkr": payables["total_payables_pkr"],
        "payables_due_7d_pkr": payables["due_within_horizon_pkr"],
        "payables_overdue_pkr": payables["overdue_pkr"],
        "cash_in_hand_pkr": cash["cash_in_hand_pkr"],
        "daily_revenue": series,
    }
