"""Inventory health: demand, days of cover, stockout risk and reorder quantities.

Rules (all deterministic, shown to the shopkeeper as reasons):

* Average daily demand = units sold in the last `lookback_days` / `lookback_days`.
  Demand is "unknown" when the product sold on fewer than 3 days in that window.
* Days of cover = stock on hand / daily demand.
* Effective cover also counts orders already on the way that arrive within the lead time.
* Risk, comparing effective cover with the supplier lead time L and safety days S:
    critical: cover < L        (will run out before a new order can arrive)
    high:     cover < L + S
    medium:   cover < (L + S) x 1.5
    ok:       otherwise
    unknown:  not enough sales history to say
* Reorder point = daily demand x (L + S).
* Recommended quantity = max(0, daily demand x (L + target cover) - stock - pending).
* Dead stock signal: stock > 0 and no sale in `dead_stock_days` (a signal, not a verdict).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.clock import store_now
from app.models import Product, Purchase, PurchaseLine, Sale, SaleLine
from app.core.wording import days

DEFAULT_LOOKBACK_DAYS = 28
DEFAULT_TARGET_COVER_DAYS = 14
DEAD_STOCK_DAYS = 30
MIN_SALE_DAYS_FOR_DEMAND = 3

CATEGORY_ICON_MAP = {
    "Cooking Oil & Ghee": "cooking_oil.svg",
    "Grains & Pulses": "grains_pulses.svg",
    "Tea & Beverages": "tea_beverages.svg",
    "Spices & Mixes": "spices_mixes.svg",
    "Dairy & Breakfast": "dairy_breakfast.svg",
    "Cleaning & Laundry": "cleaning_laundry.svg",
    "Personal Care": "personal_care.svg",
    "Snacks & Biscuits": "snacks_biscuits.svg",
}

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "images"


def product_image_url(sku: str, category: str) -> str:
    """Local image served by the backend: a product photo if we have one, else the category icon."""
    for ext in ("png", "jpg", "svg"):
        if (STATIC_DIR / "products" / f"{sku}.{ext}").exists():
            return f"/static/images/products/{sku}.{ext}"
    return f"/static/images/categories/{CATEGORY_ICON_MAP.get(category, 'grains_pulses.svg')}"


def _risk(effective_cover: float | None, lead: int, safety: int) -> str:
    if effective_cover is None:
        return "unknown"
    if effective_cover < lead:
        return "critical"
    if effective_cover < lead + safety:
        return "high"
    if effective_cover < (lead + safety) * 1.5:
        return "medium"
    return "ok"


def _risk_reason(risk: str, cover: float | None, effective: float | None, lead: int, safety: int, pending: float) -> str:
    if risk == "unknown":
        return "Not enough recent sales to estimate demand."
    on_way = f" ({pending:.0f} units on the way)" if pending > 0 else ""
    if risk == "critical":
        return f"Stock lasts {effective:.1f} days{on_way}, but a new order takes {days(lead)} to arrive."
    if risk == "high":
        return f"Stock lasts {effective:.1f} days{on_way}; lead time {days(lead)} plus {days(safety)} of safety stock."
    if risk == "medium":
        return f"Stock lasts {effective:.1f} days{on_way}; reorder soon."
    return f"Stock lasts {cover:.1f} days{on_way}."


def _risk_reason_ur(risk: str, cover: float | None, effective: float | None, lead: int, safety: int, pending: float) -> str:
    if risk == "unknown":
        return "Haal hi ki sale kam hai, is liye andaza nahi lagaya ja sakta."
    on_way = f" ({pending:.0f} raste mein)" if pending > 0 else ""
    if risk == "critical":
        return f"Stock sirf {effective:.1f} din chalega{on_way}, jabke naya maal aane mein {lead} din lagte hain."
    if risk == "high":
        return f"Stock {effective:.1f} din chalega{on_way}; supplier {lead} din + {safety} din hifazati waqt."
    if risk == "medium":
        return f"Stock {effective:.1f} din chalega{on_way}; jald order karein."
    return f"Stock {cover:.1f} din chalega{on_way}."


def compute_inventory_health(
    db: Session,
    store_id: int = 1,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    target_cover_days: int = DEFAULT_TARGET_COVER_DAYS,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    now = now or store_now()
    window_start = now - timedelta(days=lookback_days)

    sold = {
        row.product_id: (float(row.units), int(row.days))
        for row in db.query(
            SaleLine.product_id,
            func.sum(SaleLine.qty).label("units"),
            func.count(func.distinct(func.date(Sale.timestamp))).label("days"),
        )
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.timestamp >= window_start, Sale.timestamp <= now)
        .group_by(SaleLine.product_id)
    }

    last_sold = {
        row.product_id: row.last
        for row in db.query(SaleLine.product_id, func.max(Sale.timestamp).label("last"))
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.status == "completed", Sale.timestamp <= now)
        .group_by(SaleLine.product_id)
    }

    pending: dict[int, dict[str, Any]] = {}
    for line, purchase in (
        db.query(PurchaseLine, Purchase)
        .join(Purchase, Purchase.purchase_id == PurchaseLine.purchase_id)
        .filter(Purchase.store_id == store_id, Purchase.status == "pending")
    ):
        open_qty = max(0.0, line.qty - line.received_qty)
        if open_qty <= 0:
            continue
        entry = pending.setdefault(line.product_id, {"qty": 0.0, "next_date": None, "qty_by_date": []})
        entry["qty"] += open_qty
        entry["qty_by_date"].append((purchase.expected_date, open_qty))
        if purchase.expected_date and (entry["next_date"] is None or purchase.expected_date < entry["next_date"]):
            entry["next_date"] = purchase.expected_date

    products = (
        db.query(Product)
        .options(joinedload(Product.pack), joinedload(Product.supplier))
        .filter(Product.store_id == store_id, Product.active.is_(True))
        .order_by(Product.product_id)
        .all()
    )

    records: list[dict[str, Any]] = []
    for p in products:
        units, sale_days = sold.get(p.product_id, (0.0, 0))
        lead = p.lead_time_days or 3
        safety = p.safety_stock_days or 2
        pend = pending.get(p.product_id, {"qty": 0.0, "next_date": None, "qty_by_date": []})

        demand_known = sale_days >= MIN_SALE_DAYS_FOR_DEMAND
        daily_demand = units / lookback_days if demand_known else None

        if daily_demand:
            cover = p.stock_qty / daily_demand
            arriving_in_lead = sum(
                q for when, q in pend["qty_by_date"] if when is None or when <= now + timedelta(days=lead)
            )
            effective = (p.stock_qty + arriving_in_lead) / daily_demand
            reorder_point = daily_demand * (lead + safety)
            target_stock = daily_demand * (lead + target_cover_days)
            recommended = max(0.0, target_stock - p.stock_qty - pend["qty"])
        else:
            cover = effective = None
            reorder_point = target_stock = recommended = 0.0

        risk = _risk(effective, lead, safety)
        last = last_sold.get(p.product_id)
        days_since_sale = (now - last).days if last else None
        is_dead = p.stock_qty > 0 and (days_since_sale is None or days_since_sale >= DEAD_STOCK_DAYS)
        margin_pct = (p.selling_price - p.cost_price) / p.selling_price * 100 if p.selling_price else 0.0

        records.append({
            "product_id": p.product_id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "cost_price": p.cost_price,
            "selling_price": p.selling_price,
            "margin_pct": round(margin_pct, 1),
            "stock_qty": round(p.stock_qty, 2),
            "stock_value_pkr": round(p.stock_qty * p.cost_price, 2),
            "lead_time_days": lead,
            "safety_stock_days": safety,
            "supplier_id": p.supplier_id,
            "supplier_name": p.supplier.name if p.supplier else None,
            "image_url": product_image_url(p.sku, p.category),
            "average_daily_demand": round(daily_demand, 2) if daily_demand else None,
            "units_sold_lookback": round(units, 2),
            "lookback_days": lookback_days,
            "days_of_cover": round(cover, 1) if cover is not None else None,
            "effective_cover_days": round(effective, 1) if effective is not None else None,
            "stockout_risk": risk,
            "risk_reason": _risk_reason(risk, cover, effective, lead, safety, pend["qty"]),
            "risk_reason_ur": _risk_reason_ur(risk, cover, effective, lead, safety, pend["qty"]),
            "is_out_of_stock": p.stock_qty <= 0,
            "reorder_point": round(reorder_point, 1),
            "target_stock": round(target_stock, 1),
            "pending_receipts": round(pend["qty"], 1),
            "next_delivery_date": pend["next_date"],
            "recommended_order_qty": round(recommended, 1),
            "last_sold_at": last,
            "days_since_last_sale": days_since_sale,
            "is_dead_stock": is_dead,
            "pack_info": {
                "pack_unit": p.pack.pack_unit,
                "units_per_pack": p.pack.units_per_pack,
                "sell_unit": p.pack.sell_unit,
            } if p.pack else None,
        })
    return records
