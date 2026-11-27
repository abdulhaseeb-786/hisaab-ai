"""Today's 3 Ranked Actions Engine.
Requirement HOME-01:
Ranked actions generated deterministically from backend signals:
1. Critical stockout / reorder action (e.g. Cooking Oil with 1.3 days cover and 4-day lead time)
2. Margin squeeze price fix (e.g. Sufi Canola Oil cost increase not passed on)
3. Overdue Khata customer collection follow-up (e.g. Tariq Bhai 48 days overdue)
"""

from datetime import datetime, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.margin_detector import detect_margin_squeezes
from app.analytics.credit_aging import calculate_credit_summary

def get_today_three_actions(db: Session, store_id: int = 1) -> List[Dict[str, Any]]:
    """Generate the top 3 highest-priority business actions for today."""
    actions = []

    # Action Candidate 1: Critical Stockout Risk
    inv_health = compute_inventory_health(db, store_id=store_id)
    critical_items = [item for item in inv_health if item["stockout_risk"] == "critical"]
    critical_items.sort(key=lambda x: (x["days_of_cover"] or 0))

    if critical_items:
        top_stock = critical_items[0]
        lead_time = top_stock["lead_time_days"]
        cover = top_stock["days_of_cover"] or 0.0
        pack_u = top_stock["pack_info"]["pack_unit"] if top_stock["pack_info"] else "cartons"
        actions.append({
            "id": "action-stockout-1",
            "priority": 1,
            "category": "inventory",
            "urgency": "critical",
            "image_url": "https://pictures.grocerapps.com/original/grocerapp-dalda-cooking-oil-standing-pouch-65a387b5afc3d.png",
            "local_image_url": "/static/images/products/OIL-001.png",
            "title": f"Critical Stockout: Reorder {top_stock['name']}",
            "summary": f"Only {top_stock['stock_qty']:.0f} units remaining ({cover:.1f} days of cover). Supplier lead time is {lead_time} days.",
            "evidence": {
                "sku": top_stock["sku"],
                "product_name": top_stock["name"],
                "stock_on_hand": top_stock["stock_qty"],
                "days_of_cover": cover,
                "lead_time_days": lead_time,
                "daily_velocity": top_stock["average_daily_demand"]
            },
            "next_step": f"Open Reorder Planner and place an order for at least 2 {pack_u} from supplier immediately."
        })

    # Action Candidate 2: Margin Squeeze
    squeezes = detect_margin_squeezes(db, store_id=store_id)
    if squeezes:
        top_squeeze = squeezes[0]
        actions.append({
            "id": "action-margin-1",
            "priority": 2,
            "category": "margin",
            "urgency": "high",
            "image_url": "https://pictures.grocerapps.com/original/grocerapp-sufi-canola-oil-pouch-619f4893d0283.jpeg",
            "local_image_url": "/static/images/products/OIL-004.jpg",
            "title": f"Margin Squeeze: Update price on {top_squeeze['name']}",
            "summary": f"Wholesale cost rose by PKR {top_squeeze['cost_increase_pkr']:.0f}, but shelf price remained at PKR {top_squeeze['shelf_selling_price_pkr']:.0f}. Margin dropped from {top_squeeze['previous_margin_pct']}% to {top_squeeze['current_margin_pct']}%.",
            "evidence": {
                "sku": top_squeeze["sku"],
                "current_cost_pkr": top_squeeze["current_cost_pkr"],
                "previous_cost_pkr": top_squeeze["previous_cost_pkr"],
                "shelf_price_pkr": top_squeeze["shelf_selling_price_pkr"],
                "recommended_price_pkr": top_squeeze["recommended_selling_price_pkr"]
            },
            "next_step": f"Update shelf price tag from PKR {top_squeeze['shelf_selling_price_pkr']:.0f} to PKR {top_squeeze['recommended_selling_price_pkr']:.0f} to restore profit margin."
        })

    # Action Candidate 3: Overdue Khata Collection
    credit_sum = calculate_credit_summary(db, store_id=store_id)
    defaulters = credit_sum.get("top_defaulters", [])
    if defaulters:
        top_defaulter = defaulters[0]
        actions.append({
            "id": "action-credit-1",
            "priority": 3,
            "category": "credit",
            "urgency": "medium",
            "image_url": None,
            "local_image_url": "/static/images/icons/khata_ledger.svg",
            "title": f"Khata Recovery: Call {top_defaulter['name']}",
            "summary": f"Outstanding balance of PKR {top_defaulter['total_balance_pkr']:.0f} is {top_defaulter['days_overdue']} days overdue. Safe Mark rating degraded to {top_defaulter['safe_mark_score']:.0f}/100.",
            "evidence": {
                "customer_name": top_defaulter["name"],
                "phone": top_defaulter["phone"],
                "balance_pkr": top_defaulter["total_balance_pkr"],
                "overdue_pkr": top_defaulter["overdue_amount_pkr"],
                "days_overdue": top_defaulter["days_overdue"],
                "safe_mark_score": top_defaulter["safe_mark_score"]
            },
            "next_step": f"Call {top_defaulter['name']} at {top_defaulter['phone']} for gentle wasooli reminder before issuing further grocery credit."
        })

    return actions
