"""Margin squeeze: the supplier's cost went up but the shelf price did not.

For each product we compare the latest PriceHistory row with the one before it. A
squeeze is flagged when cost rose, the selling price did not rise, and the margin fell
by at least `threshold_pct` points. The recommended price restores the previous margin
percentage, rounded to the nearest Rs 5.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.analytics.inventory_rules import compute_inventory_health
from app.core.clock import store_now
from app.models import PriceHistory, Product


def _round_price(value: float) -> float:
    return float(round(value / 5.0) * 5)


def detect_margin_squeezes(
    db: Session,
    store_id: int = 1,
    threshold_pct: float = 3.0,
    inventory: list[dict[str, Any]] | None = None,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    now = now or store_now()
    inventory = inventory if inventory is not None else compute_inventory_health(db, store_id=store_id, now=now)
    by_id = {i["product_id"]: i for i in inventory}

    history: dict[int, list[PriceHistory]] = {}
    for ph in (
        db.query(PriceHistory)
        .join(Product, Product.product_id == PriceHistory.product_id)
        .filter(Product.store_id == store_id, Product.active.is_(True), PriceHistory.effective_date <= now)
        .order_by(PriceHistory.product_id, PriceHistory.effective_date.desc(), PriceHistory.history_id.desc())
    ):
        rows = history.setdefault(ph.product_id, [])
        if len(rows) < 2:
            rows.append(ph)

    results = []
    for product_id, rows in history.items():
        if len(rows) < 2 or product_id not in by_id:
            continue
        latest, previous = rows
        if not (latest.cost_price > previous.cost_price and latest.selling_price <= previous.selling_price):
            continue
        prev_margin = (previous.selling_price - previous.cost_price) / previous.selling_price * 100
        curr_margin = (latest.selling_price - latest.cost_price) / latest.selling_price * 100
        drop = prev_margin - curr_margin
        if drop < threshold_pct:
            continue

        item = by_id[product_id]
        recommended = _round_price(latest.cost_price / (1 - prev_margin / 100))
        demand = item["average_daily_demand"] or 0.0
        monthly_profit_at_risk = demand * 30 * (recommended - latest.selling_price)
        cost_increase = latest.cost_price - previous.cost_price

        results.append({
            "product_id": product_id,
            "sku": item["sku"],
            "name": item["name"],
            "category": item["category"],
            "image_url": item["image_url"],
            "previous_cost_pkr": previous.cost_price,
            "current_cost_pkr": latest.cost_price,
            "cost_increase_pkr": round(cost_increase, 2),
            "cost_increase_pct": round(cost_increase / previous.cost_price * 100, 1),
            "shelf_selling_price_pkr": latest.selling_price,
            "previous_margin_pct": round(prev_margin, 1),
            "current_margin_pct": round(curr_margin, 1),
            "margin_drop_pct": round(drop, 1),
            "recommended_selling_price_pkr": recommended,
            "average_daily_demand": item["average_daily_demand"],
            "monthly_profit_at_risk_pkr": round(monthly_profit_at_risk, 0),
            "cost_changed_on": latest.effective_date,
            "days_since_cost_change": (now - latest.effective_date).days,
            "change_reason": latest.reason,
            "evidence": (
                f"Cost went from Rs {previous.cost_price:,.0f} to Rs {latest.cost_price:,.0f} on "
                f"{latest.effective_date:%d %b}, but the shelf price is still Rs {latest.selling_price:,.0f}."
            ),
            "recommended_action": (
                f"Change the shelf price from Rs {latest.selling_price:,.0f} to Rs {recommended:,.0f} "
                f"to get back to a {prev_margin:.1f}% margin."
            ),
        })

    results.sort(key=lambda r: r["monthly_profit_at_risk_pkr"], reverse=True)
    return results
