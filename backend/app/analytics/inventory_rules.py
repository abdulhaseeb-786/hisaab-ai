"""Deterministic Inventory Health & Stockout Risk Rules.
Formulas:
- Daily Demand: Average units sold per day over 14 days lookback
- Days of Cover: Product.stock_qty / Daily Demand (None if demand is 0)
- Stockout Risk:
    - critical: Cover <= Lead Time
    - high: Cover <= Lead Time + Safety Stock
    - medium: Cover <= (Lead Time + Safety Stock) * 1.5
    - safe: Cover > (Lead Time + Safety Stock) * 1.5
    - unknown: Zero/insufficient sales data
- Reorder Point: (Lead Time + Safety Stock) * Daily Demand
- Recommended Qty: max(0, Target Stock - Stock On Hand - Pending Receipts)
"""

from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Product, SaleLine, Sale, PurchaseLine, Purchase

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

STATIC_PRODUCTS_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "images" / "products"

def compute_inventory_health(
    db: Session,
    store_id: int = 1,
    lookback_days: int = 14,
    target_cover_days: int = 14
) -> List[Dict[str, Any]]:
    """Compute days of cover, risk status, and reorder signals for all products."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    lookback_start = now - timedelta(days=lookback_days)

    # 1. Calculate units sold per product in lookback period
    sales_subq = (
        db.query(
            SaleLine.product_id,
            func.coalesce(func.sum(SaleLine.qty), 0.0).label("units_sold")
        )
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.timestamp >= lookback_start)
        .group_by(SaleLine.product_id)
        .all()
    )
    units_sold_map = {row.product_id: float(row.units_sold) for row in sales_subq}

    # 2. Calculate pending receipts (ordered - received)
    pending_subq = (
        db.query(
            PurchaseLine.product_id,
            func.coalesce(func.sum(PurchaseLine.qty - PurchaseLine.received_qty), 0.0).label("pending_qty")
        )
        .join(Purchase, Purchase.purchase_id == PurchaseLine.purchase_id)
        .filter(Purchase.store_id == store_id, Purchase.status != "cancelled")
        .group_by(PurchaseLine.product_id)
        .all()
    )
    pending_map = {row.product_id: max(0.0, float(row.pending_qty)) for row in pending_subq}

    # 3. Retrieve all active products
    products = db.query(Product).filter(Product.store_id == store_id, Product.active == True).all()

    health_records = []
    for p in products:
        units_sold = units_sold_map.get(p.product_id, 0.0)
        daily_demand = units_sold / float(lookback_days)
        pending = pending_map.get(p.product_id, 0.0)

        lead_time = p.lead_time_days or 3
        safety_stock_days = p.safety_stock_days or 2
        safety_buffer_days = lead_time + safety_stock_days

        if daily_demand > 0.05:
            days_of_cover = p.stock_qty / daily_demand
            reorder_point = safety_buffer_days * daily_demand
            target_stock = (lead_time + target_cover_days) * daily_demand
            net_need = max(0.0, target_stock - p.stock_qty - pending)

            if days_of_cover <= lead_time:
                risk_status = "critical"
            elif days_of_cover <= safety_buffer_days:
                risk_status = "high"
            elif days_of_cover <= safety_buffer_days * 1.5:
                risk_status = "medium"
            else:
                risk_status = "safe"
        else:
            days_of_cover = None
            reorder_point = 0.0
            target_stock = 0.0
            net_need = 0.0
            risk_status = "unknown"

        pack_info = None
        if p.pack:
            pack_info = {
                "pack_unit": p.pack.pack_unit,
                "units_per_pack": p.pack.units_per_pack,
                "sell_unit": p.pack.sell_unit
            }

        # Check for real downloaded photograph first (png, jpg), then svg, then category icon
        if (STATIC_PRODUCTS_DIR / f"{p.sku}.png").exists():
            local_img = f"/static/images/products/{p.sku}.png"
        elif (STATIC_PRODUCTS_DIR / f"{p.sku}.jpg").exists():
            local_img = f"/static/images/products/{p.sku}.jpg"
        elif (STATIC_PRODUCTS_DIR / f"{p.sku}.svg").exists():
            local_img = f"/static/images/products/{p.sku}.svg"
        else:
            cat_icon = CATEGORY_ICON_MAP.get(p.category, "cooking_oil.svg")
            local_img = f"/static/images/categories/{cat_icon}"

        health_records.append({
            "product_id": p.product_id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "unit": p.unit,
            "cost_price": p.cost_price,
            "selling_price": p.selling_price,
            "stock_qty": p.stock_qty,
            "lead_time_days": lead_time,
            "safety_stock_days": safety_stock_days,
            "image_url": p.image_url,
            "local_image_url": local_img,
            "average_daily_demand": round(daily_demand, 2),
            "days_of_cover": round(days_of_cover, 1) if days_of_cover is not None else None,
            "stockout_risk": risk_status,
            "reorder_point": round(reorder_point, 1),
            "pending_receipts": round(pending, 1),
            "target_stock": round(target_stock, 1),
            "recommended_order_qty": round(net_need, 1),
            "pack_info": pack_info
        })

    return health_records
