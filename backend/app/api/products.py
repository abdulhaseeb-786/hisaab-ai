from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.models import Product, PriceHistory, StockMovement
from app.analytics.inventory_rules import compute_inventory_health
from app.schemas.inventory import ProductResponse, ProductDetailResponse, PriceUpdateRequest, StockAdjustmentRequest

router = APIRouter(prefix="/products", tags=["Inventory & Products"])

@router.get("", response_model=List[ProductResponse])
def list_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,  # critical, high, safe, all
    store_id: int = 1,
    db: Session = Depends(get_db)
):
    """GET /api/products: Returns products with stock cover, risk status, and pack units."""
    health_list = compute_inventory_health(db, store_id=store_id)

    results = []
    for item in health_list:
        if search and search.lower() not in item["name"].lower() and search.lower() not in item["sku"].lower():
            continue
        if category and category.lower() not in item["category"].lower():
            continue
        if status and status != "all" and item["stockout_risk"] != status:
            continue
        results.append(item)

    return results

@router.get("/{product_id}", response_model=ProductDetailResponse)
def get_product_detail(product_id: int, store_id: int = 1, db: Session = Depends(get_db)):
    """GET /api/products/{id}: Returns detailed product metrics, pending orders, and price history."""
    health_list = compute_inventory_health(db, store_id=store_id)
    matched = [h for h in health_list if h["product_id"] == product_id]
    if not matched:
        raise HTTPException(status_code=404, detail="Product not found.")

    item = matched[0]
    prod = db.query(Product).filter(Product.product_id == product_id).first()

    # Fetch price history
    history = (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.effective_date.desc())
        .all()
    )
    price_changes = [
        {
            "effective_date": ph.effective_date.isoformat(),
            "cost_price": ph.cost_price,
            "selling_price": ph.selling_price,
            "reason": ph.reason
        }
        for ph in history
    ]

    sup_name = prod.supplier.name if prod.supplier else "Local Distributor"

    return {
        **item,
        "supplier_name": sup_name,
        "recent_price_changes": price_changes
    }

@router.patch("/{product_id}/price")
def update_product_price(
    product_id: int,
    payload: PriceUpdateRequest,
    db: Session = Depends(get_db)
):
    """Updates selling price dynamically and logs a price history record."""
    prod = db.query(Product).filter(Product.product_id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")
    
    prod.selling_price = payload.new_selling_price
    history_entry = PriceHistory(
        product_id=product_id,
        effective_date=datetime.now(timezone.utc).replace(tzinfo=None),
        cost_price=prod.cost_price,
        selling_price=payload.new_selling_price,
        reason=payload.reason
    )
    db.add(history_entry)
    db.commit()
    return {"message": "Price updated successfully", "product_id": product_id, "new_price": payload.new_selling_price}

@router.post("/{product_id}/stock-adjustment")
def adjust_stock(
    product_id: int,
    payload: StockAdjustmentRequest,
    db: Session = Depends(get_db)
):
    """Simulates immediate stock delivery or inventory adjustment."""
    prod = db.query(Product).filter(Product.product_id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")
    
    prod.stock_qty += payload.quantity_change
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    movement = StockMovement(
        store_id=prod.store_id,
        product_id=product_id,
        timestamp=now,
        movement_type="adjustment",
        qty_delta=payload.quantity_change,
        reference_id="manual_adjustment",
        reason=payload.reason
    )
    db.add(movement)
    db.commit()
    return {"message": "Stock adjusted successfully", "product_id": product_id, "new_stock": prod.stock_qty}

