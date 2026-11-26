"""Dead-Stock Signal Detector.
Requirement INV-03, Section 5:
- Stock quantity > 0
- No sales within the configurable lookback window (default 30 days)
- Labeled as a 'signal, not a certainty'
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Product, SaleLine, Sale

def detect_dead_stock(db: Session, store_id: int = 1, lookback_days: int = 30) -> List[Dict[str, Any]]:
    """Detect slow-moving or stagnant items that have positive stock but 0 sales."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    lookback_start = now - timedelta(days=lookback_days)

    # Find products that had at least one sale in lookback window
    active_product_ids = (
        db.query(SaleLine.product_id)
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.timestamp >= lookback_start)
        .distinct()
        .all()
    )
    active_set = {row[0] for row in active_product_ids}

    # Products with stock > 0 that are NOT in active_set
    stagnant_prods = (
        db.query(Product)
        .filter(
            Product.store_id == store_id,
            Product.active == True,
            Product.stock_qty > 0.0,
            ~Product.product_id.in_(active_set)
        )
        .all()
    )

    results = []
    for p in stagnant_prods:
        tied_up_capital = p.stock_qty * p.cost_price
        results.append({
            "product_id": p.product_id,
            "sku": p.sku,
            "name": p.name,
            "category": p.category,
            "stock_qty": p.stock_qty,
            "cost_price_pkr": p.cost_price,
            "selling_price_pkr": p.selling_price,
            "tied_up_capital_pkr": round(tied_up_capital, 2),
            "lookback_days": lookback_days,
            "signal_status": "potential_dead_stock",
            "evidence": f"Zero units sold in the last {lookback_days} days while holding {p.stock_qty:.0f} units in stock.",
            "recommended_action": f"Bundle with fast-moving goods or discount by 10-15% to free up PKR {tied_up_capital:.0f} tied-up capital."
        })

    # Sort descending by tied-up capital
    results.sort(key=lambda x: x["tied_up_capital_pkr"], reverse=True)
    return results
