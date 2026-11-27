from collections import Counter
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.analytics.inventory_rules import compute_inventory_health
from app.core.clock import store_now
from app.core.database import get_db
from app.models import PriceHistory, Product, Sale, SaleLine, StockMovement
from app.schemas.inventory import (
    PriceUpdateRequest, PriceUpdateResponse, ProductDetailResponse, ProductListResponse,
    StockAdjustmentRequest, StockAdjustmentResponse,
)

router = APIRouter(prefix="/products", tags=["Inventory & Products"])

RISK_ORDER = {"critical": 0, "high": 1, "medium": 2, "unknown": 3, "ok": 4}
StatusFilter = Literal["all", "critical", "high", "medium", "ok", "unknown", "at_risk", "dead_stock", "out_of_stock"]


@router.get("", response_model=ProductListResponse)
def list_products(
    search: Optional[str] = Query(default=None, max_length=80),
    category: Optional[str] = None,
    status: StatusFilter = "all",
    sort: Literal["risk", "name", "cover", "value"] = "risk",
    store_id: int = 1,
    db: Session = Depends(get_db),
):
    """Products with days of cover, risk and the reason, plus counts for the filter chips (INV-01, INV-02)."""
    items = compute_inventory_health(db, store_id=store_id)
    counts = Counter(i["stockout_risk"] for i in items)
    counts["at_risk"] = counts["critical"] + counts["high"]
    counts["dead_stock"] = sum(1 for i in items if i["is_dead_stock"])
    counts["out_of_stock"] = sum(1 for i in items if i["is_out_of_stock"])
    counts["all"] = len(items)
    categories = sorted({i["category"] for i in items})

    if search:
        q = search.lower().strip()
        items = [i for i in items if q in i["name"].lower() or q in i["sku"].lower()]
    if category:
        items = [i for i in items if i["category"] == category]
    if status == "at_risk":
        items = [i for i in items if i["stockout_risk"] in ("critical", "high")]
    elif status == "dead_stock":
        items = [i for i in items if i["is_dead_stock"]]
    elif status == "out_of_stock":
        items = [i for i in items if i["is_out_of_stock"]]
    elif status != "all":
        items = [i for i in items if i["stockout_risk"] == status]

    if sort == "name":
        items.sort(key=lambda i: i["name"])
    elif sort == "cover":
        items.sort(key=lambda i: (i["effective_cover_days"] is None, i["effective_cover_days"] or 0))
    elif sort == "value":
        items.sort(key=lambda i: -i["stock_value_pkr"])
    else:
        items.sort(key=lambda i: (RISK_ORDER[i["stockout_risk"]], i["effective_cover_days"] or 9999, i["name"]))

    return {"total": len(items), "counts_by_risk": dict(counts), "categories": categories, "products": items}


@router.get("/{product_id}", response_model=ProductDetailResponse)
def get_product_detail(product_id: int, store_id: int = 1, db: Session = Depends(get_db)):
    """One product: health, price history, recent stock movements and the last 30 days' sales."""
    now = store_now()
    item = next((h for h in compute_inventory_health(db, store_id=store_id, now=now) if h["product_id"] == product_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Product not found.")

    history = (
        db.query(PriceHistory).filter(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.effective_date.desc(), PriceHistory.history_id.desc()).limit(12).all()
    )
    movements = (
        db.query(StockMovement)
        .filter(StockMovement.product_id == product_id, StockMovement.movement_type != "sale")
        .order_by(StockMovement.timestamp.desc()).limit(10).all()
    )
    since = now - timedelta(days=30)
    units, revenue, profit = (
        db.query(
            func.coalesce(func.sum(SaleLine.qty), 0.0),
            func.coalesce(func.sum(SaleLine.qty * SaleLine.unit_price), 0.0),
            func.coalesce(func.sum(SaleLine.qty * (SaleLine.unit_price - SaleLine.unit_cost_snapshot)), 0.0),
        )
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(SaleLine.product_id == product_id, Sale.status == "completed", Sale.timestamp >= since)
        .one()
    )

    return {
        **item,
        "price_history": [
            {
                "effective_date": h.effective_date,
                "cost_price": h.cost_price,
                "selling_price": h.selling_price,
                "margin_pct": round((h.selling_price - h.cost_price) / h.selling_price * 100, 1) if h.selling_price else 0.0,
                "reason": h.reason,
            }
            for h in history
        ],
        "recent_movements": [
            {"timestamp": m.timestamp, "movement_type": m.movement_type, "qty_delta": m.qty_delta, "reason": m.reason}
            for m in movements
        ],
        "units_sold_30d": round(float(units), 2),
        "revenue_30d_pkr": round(float(revenue), 0),
        "gross_profit_30d_pkr": round(float(profit), 0),
    }


@router.patch("/{product_id}/price", response_model=PriceUpdateResponse)
def update_product_price(product_id: int, payload: PriceUpdateRequest, db: Session = Depends(get_db)):
    """Change the shelf price. A price-history row is recorded so the margin check sees it."""
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")
    old = prod.selling_price
    prod.selling_price = round(payload.new_selling_price, 2)
    db.add(PriceHistory(product_id=product_id, effective_date=store_now(), cost_price=prod.cost_price,
                        selling_price=prod.selling_price, reason=payload.reason))
    db.commit()
    margin = (prod.selling_price - prod.cost_price) / prod.selling_price * 100
    return {
        "product_id": product_id,
        "old_selling_price": old,
        "new_selling_price": prod.selling_price,
        "new_margin_pct": round(margin, 1),
        "message": f"Price changed from Rs {old:,.0f} to Rs {prod.selling_price:,.0f}.",
    }


@router.post("/{product_id}/stock-adjustment", response_model=StockAdjustmentResponse)
def adjust_stock(product_id: int, payload: StockAdjustmentRequest, db: Session = Depends(get_db)):
    """Record stock received or written off. Stock can never go below zero."""
    prod = db.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")
    if payload.quantity_change == 0:
        raise HTTPException(status_code=422, detail="Quantity change cannot be zero.")
    old = prod.stock_qty
    if old + payload.quantity_change < 0:
        raise HTTPException(status_code=422, detail=f"Only {old:g} in stock; cannot remove {-payload.quantity_change:g}.")
    prod.stock_qty = round(old + payload.quantity_change, 2)
    db.add(StockMovement(store_id=prod.store_id, product_id=product_id, timestamp=store_now(),
                         movement_type="adjustment", qty_delta=payload.quantity_change,
                         reference_id="MANUAL", reason=payload.reason))
    db.commit()
    return {
        "product_id": product_id,
        "old_stock": old,
        "new_stock": prod.stock_qty,
        "message": f"Stock changed from {old:g} to {prod.stock_qty:g}.",
    }
