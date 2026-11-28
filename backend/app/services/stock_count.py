"""Ginti: count what is really on the shelf, and let the count fix the records.

The shopkeeper counts one shelf (category) at a time. For every item, HisaabAI compares
the count with what the records expect, and explains the gap since the last count:

    expected now = last count + received since + adjustments since - recorded sales since

A shortfall is either loss (damage, expiry, theft) or sales that were not written down.
Many kiryana shops never record every cash sale, so the shopkeeper chooses:

* "loss": the shortfall is booked as a stock adjustment at cost.
* "sales": the shortfall is booked as cash sales at the shelf price, so the day's sales,
  profit and galla expectation include them. This is how a shop with no billing can
  still get its numbers from a weekly count.

Extra stock (counted more than expected) is always booked as an adjustment.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.inventory_rules import product_image_url
from app.core.clock import store_now
from app.models import Product, Sale, SaleLine, StockCount, StockCountLine, StockMovement


class CountError(ValueError):
    pass


def _last_counts(db: Session, product_ids: list[int]) -> dict[int, tuple[datetime, float]]:
    sub = (
        db.query(StockCountLine.product_id, func.max(StockCount.timestamp).label("ts"))
        .join(StockCount, StockCount.count_id == StockCountLine.count_id)
        .filter(StockCountLine.product_id.in_(product_ids))
        .group_by(StockCountLine.product_id)
        .subquery()
    )
    out: dict[int, tuple[datetime, float]] = {}
    for pid, ts, qty in (
        db.query(StockCountLine.product_id, StockCount.timestamp, StockCountLine.counted_qty)
        .join(StockCount, StockCount.count_id == StockCountLine.count_id)
        .join(sub, (sub.c.product_id == StockCountLine.product_id) & (sub.c.ts == StockCount.timestamp))
    ):
        out[pid] = (ts, qty)
    return out


def count_sheet(db: Session, category: str | None = None, store_id: int = 1) -> dict[str, Any]:
    q = db.query(Product).filter(Product.store_id == store_id, Product.active.is_(True))
    products = q.order_by(Product.category, Product.name).all()
    categories: dict[str, int] = {}
    for p in products:
        categories[p.category] = categories.get(p.category, 0) + 1
    shown = [p for p in products if not category or p.category == category]
    last = _last_counts(db, [p.product_id for p in shown])
    return {
        "categories": [{"category": c, "items": n} for c, n in categories.items()],
        "category": category,
        "items": [{
            "product_id": p.product_id,
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "image_url": p.image_url or product_image_url(p.sku, p.category),
            "expected_qty": round(p.stock_qty or 0.0, 3),
            "cost_price": p.cost_price,
            "selling_price": p.selling_price,
            "last_counted_at": last.get(p.product_id, (None, None))[0],
            "last_counted_qty": last.get(p.product_id, (None, None))[1],
        } for p in shown],
    }


def submit_count(db: Session, lines: list[dict[str, Any]], treat_short_as: str = "loss", note: str | None = None,
                 store_id: int = 1, now: datetime | None = None) -> dict[str, Any]:
    now = now or store_now()
    if treat_short_as not in ("loss", "sales"):
        raise CountError("A shortfall is either loss or sales.")
    if not lines:
        raise CountError("Count at least one item.")
    ids = [l["product_id"] for l in lines]
    products = {p.product_id: p for p in db.query(Product).filter(Product.product_id.in_(ids), Product.store_id == store_id)}
    if len(products) != len(set(ids)):
        raise CountError("One of the items is not in this shop.")
    last = _last_counts(db, ids)

    count = StockCount(store_id=store_id, timestamp=now, note=note)
    db.add(count)
    db.flush()

    out_lines, short_sales = [], []
    matched = 0
    short_value_cost = short_value_price = extra_value_cost = 0.0
    for l in lines:
        p = products[l["product_id"]]
        counted = float(l["counted_qty"])
        if counted < 0:
            raise CountError(f"Count for {p.name} cannot be negative.")
        expected = round(p.stock_qty or 0.0, 3)
        diff = round(counted - expected, 3)
        db.add(StockCountLine(count_id=count.count_id, product_id=p.product_id, expected_qty=expected,
                              counted_qty=counted, unit_cost=p.cost_price))

        since = last.get(p.product_id)
        recorded_sold = None
        if since:
            recorded_sold = float(
                db.query(func.coalesce(func.sum(-StockMovement.qty_delta), 0.0))
                .filter(StockMovement.product_id == p.product_id, StockMovement.movement_type == "sale",
                        StockMovement.timestamp > since[0], StockMovement.timestamp <= now).scalar()
            )

        if abs(diff) < 1e-9:
            matched += 1
        elif diff > 0:
            extra_value_cost += diff * p.cost_price
            db.add(StockMovement(store_id=store_id, product_id=p.product_id, timestamp=now, movement_type="adjustment",
                                 qty_delta=diff, reference_id=f"COUNT-{count.count_id}", reason="Ginti: extra on shelf"))
        else:
            short = -diff
            short_value_cost += short * p.cost_price
            short_value_price += short * p.selling_price
            if treat_short_as == "sales":
                short_sales.append((p, short))
            else:
                db.add(StockMovement(store_id=store_id, product_id=p.product_id, timestamp=now, movement_type="adjustment",
                                     qty_delta=diff, reference_id=f"COUNT-{count.count_id}", reason="Ginti: short on shelf"))
        p.stock_qty = counted
        out_lines.append({
            "product_id": p.product_id, "name": p.name, "unit": p.unit,
            "expected_qty": expected, "counted_qty": counted, "difference_qty": diff,
            "difference_value_pkr": round(diff * p.cost_price, 2),
            "last_counted_at": since[0] if since else None,
            "recorded_sales_since_last_count": round(recorded_sold, 3) if recorded_sold is not None else None,
            # Records say `recorded_sold` left the shelf; the count shows `-diff` more (or less) left it.
            "sold_since_last_count": round(recorded_sold - diff, 3) if recorded_sold is not None else None,
        })

    sale_id = None
    if short_sales:
        total = round(sum(q * p.selling_price for p, q in short_sales), 2)
        sale = Sale(store_id=store_id, timestamp=now, payment_type="cash", status="completed", total=total, discount=0.0)
        db.add(sale)
        db.flush()
        sale_id = sale.sale_id
        for p, q in short_sales:
            db.add(SaleLine(sale_id=sale.sale_id, product_id=p.product_id, qty=q, unit_price=p.selling_price,
                            unit_cost_snapshot=p.cost_price, discount=0.0))
            db.add(StockMovement(store_id=store_id, product_id=p.product_id, timestamp=now, movement_type="sale",
                                 qty_delta=-q, reference_id=f"SALE-{sale.sale_id}", reason="Ginti: sales not written down"))
    db.commit()

    short_lines = [l for l in out_lines if l["difference_qty"] < 0]
    return {
        "count_id": count.count_id,
        "timestamp": now,
        "treat_short_as": treat_short_as,
        "items_counted": len(out_lines),
        "items_matched": matched,
        "items_short": len(short_lines),
        "items_extra": sum(1 for l in out_lines if l["difference_qty"] > 0),
        "short_value_at_cost_pkr": round(short_value_cost, 2),
        "short_value_at_price_pkr": round(short_value_price, 2),
        "extra_value_at_cost_pkr": round(extra_value_cost, 2),
        "inferred_sale_id": sale_id,
        "inferred_sales_pkr": round(short_value_price, 2) if sale_id else 0.0,
        "lines": sorted(out_lines, key=lambda l: l["difference_value_pkr"]),
    }


def count_history(db: Session, store_id: int = 1, limit: int = 10) -> list[dict[str, Any]]:
    out = []
    for c in db.query(StockCount).filter(StockCount.store_id == store_id).order_by(StockCount.timestamp.desc()).limit(limit):
        short = sum((l.expected_qty - l.counted_qty) * l.unit_cost for l in c.lines if l.counted_qty < l.expected_qty)
        extra = sum((l.counted_qty - l.expected_qty) * l.unit_cost for l in c.lines if l.counted_qty > l.expected_qty)
        out.append({
            "count_id": c.count_id, "timestamp": c.timestamp, "note": c.note, "items_counted": len(c.lines),
            "items_matched": sum(1 for l in c.lines if abs(l.counted_qty - l.expected_qty) < 1e-9),
            "short_value_at_cost_pkr": round(short, 2), "extra_value_at_cost_pkr": round(extra, 2),
        })
    return out
