"""Dead-stock signal: stock on the shelf with no sale in the lookback window.

It is a signal, not a verdict: an item can be seasonal. The evidence shows exactly how
long it has been since the last sale and how much money is tied up.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.analytics.inventory_rules import DEAD_STOCK_DAYS, compute_inventory_health


def detect_dead_stock(
    db: Session,
    store_id: int = 1,
    lookback_days: int = DEAD_STOCK_DAYS,
    inventory: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    inventory = inventory if inventory is not None else compute_inventory_health(db, store_id=store_id)
    results = []
    for item in inventory:
        days = item["days_since_last_sale"]
        if item["stock_qty"] <= 0 or (days is not None and days < lookback_days):
            continue
        tied = item["stock_qty"] * item["cost_price"]
        since = f"{days} days" if days is not None else "the start of the records"
        results.append({
            "product_id": item["product_id"],
            "sku": item["sku"],
            "name": item["name"],
            "category": item["category"],
            "image_url": item["image_url"],
            "stock_qty": item["stock_qty"],
            "cost_price_pkr": item["cost_price"],
            "selling_price_pkr": item["selling_price"],
            "tied_up_capital_pkr": round(tied, 2),
            "days_since_last_sale": days,
            "last_sold_at": item["last_sold_at"],
            "lookback_days": lookback_days,
            "evidence": f"No sale for {since} while {item['stock_qty']:.0f} units sit on the shelf.",
            "recommended_action": (
                f"Bundle it with a fast-moving item or give 10-15% off to free Rs {tied:,.0f}. "
                "Do not reorder until it sells again."
            ),
        })
    results.sort(key=lambda x: x["tied_up_capital_pkr"], reverse=True)
    return results
