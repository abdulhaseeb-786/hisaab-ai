"""Margin Squeeze Detection Engine.
Requirement PROF-01, PROF-02, PROF-03.
Detects when a supplier cost increased in PriceHistory but the selling price
was not raised, squeezing the retailer's gross margin.
"""

from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Product, PriceHistory

def detect_margin_squeezes(db: Session, store_id: int = 1, threshold_pct: float = 3.0) -> List[Dict[str, Any]]:
    """Find products whose cost rose while retail price stagnated, eroding margin."""
    products = db.query(Product).filter(Product.store_id == store_id, Product.active == True).all()
    
    squeezed_items = []

    for p in products:
        # Check PriceHistory for this product (ordered latest first)
        history = (
            db.query(PriceHistory)
            .filter(PriceHistory.product_id == p.product_id)
            .order_by(PriceHistory.effective_date.desc())
            .limit(2)
            .all()
        )

        if len(history) >= 2:
            latest = history[0]
            previous = history[1]

            # Condition: Cost went UP, but selling price did NOT increase proportionally
            if latest.cost_price > previous.cost_price and latest.selling_price <= previous.selling_price:
                prev_profit = previous.selling_price - previous.cost_price
                prev_margin_pct = (prev_profit / previous.selling_price * 100.0) if previous.selling_price > 0 else 0.0

                curr_profit = latest.selling_price - latest.cost_price
                curr_margin_pct = (curr_profit / latest.selling_price * 100.0) if latest.selling_price > 0 else 0.0

                margin_drop = prev_margin_pct - curr_margin_pct
                if margin_drop >= threshold_pct:
                    # Recommended price to restore original margin %
                    target_price = round(latest.cost_price / (1.0 - (prev_margin_pct / 100.0)), -1)
                    cost_increase_pkr = latest.cost_price - previous.cost_price

                    squeezed_items.append({
                        "product_id": p.product_id,
                        "sku": p.sku,
                        "name": p.name,
                        "category": p.category,
                        "previous_cost_pkr": previous.cost_price,
                        "current_cost_pkr": latest.cost_price,
                        "cost_increase_pkr": cost_increase_pkr,
                        "shelf_selling_price_pkr": latest.selling_price,
                        "previous_margin_pct": round(prev_margin_pct, 1),
                        "current_margin_pct": round(curr_margin_pct, 1),
                        "margin_drop_pct": round(margin_drop, 1),
                        "recommended_selling_price_pkr": target_price,
                        "evidence": {
                            "date_of_cost_hike": latest.effective_date.isoformat(),
                            "reason": latest.reason
                        },
                        "recommended_action": f"Wholesale cost increased by PKR {cost_increase_pkr:.0f}. Increase shelf price from PKR {latest.selling_price:.0f} to PKR {target_price:.0f} to restore {prev_margin_pct:.1f}% margin."
                    })

    return squeezed_items
