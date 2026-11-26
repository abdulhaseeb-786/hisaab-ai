"""The Hero Flow Decision Engine: Budget-Constrained Reorder Optimizer.
Answers the central question:
"I have PKR 50,000. What should I buy today and why?"

Mathematical Rules (REC-01, REC-02, REC-03, REC-04):
1. Target Coverage Stock: (Lead Time + Target Days) * Daily Demand
2. Net Deficit: max(0, Target Stock - Stock On Hand - Pending Receipts)
3. Pack Rounding: ceil(Deficit / Units Per Pack) respecting MOQ
4. Priority Scoring: Multi-criteria ranking combining Stockout Urgency & Daily Margin Contribution
5. Bounded Knapsack Allocation: Total allocated spend NEVER exceeds budget (hard mathematical guardrail)
"""

import math
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Product, Supplier, PurchasePlan, PurchasePlanLine
from app.analytics.inventory_rules import compute_inventory_health

def generate_budget_reorder_plan(
    db: Session,
    budget_pkr: float,
    store_id: int = 1,
    target_cover_days: int = 14,
    save_draft: bool = True
) -> Dict[str, Any]:
    """Generate optimal purchase plan strictly within budget, rounded to cartons/packs."""
    if budget_pkr <= 0:
        raise ValueError("Budget must be greater than zero PKR.")

    # 1. Fetch inventory health and demand metrics
    health_list = compute_inventory_health(db, store_id=store_id, target_cover_days=target_cover_days)

    # 2. Build candidate reorder list
    candidates = []
    supplier_map = {s.supplier_id: s.name for s in db.query(Supplier).filter(Supplier.store_id == store_id).all()}

    max_daily_margin = 1.0
    for item in health_list:
        demand = item["average_daily_demand"]
        if demand > 0.05 and item["recommended_order_qty"] > 0:
            daily_margin = (item["selling_price"] - item["cost_price"]) * demand
            max_daily_margin = max(max_daily_margin, daily_margin)

    for item in health_list:
        demand = item["average_daily_demand"]
        net_need_units = item["recommended_order_qty"]

        if demand <= 0.05 or net_need_units <= 0:
            continue

        pack_info = item["pack_info"]
        units_per_pack = pack_info["units_per_pack"] if pack_info else 12
        pack_unit = pack_info["pack_unit"] if pack_info else "carton"

        # Round up to wholesale pack multiples
        raw_packs = math.ceil(net_need_units / units_per_pack)
        recommended_packs = max(1, raw_packs)  # Minimum 1 pack MOQ

        total_units = recommended_packs * units_per_pack
        pack_cost = total_units * item["cost_price"]

        # Calculate Urgency Score (0.0 to 1.0)
        cover = item["days_of_cover"] or 0.0
        lead_time = item["lead_time_days"]
        safety_buf = lead_time + item["safety_stock_days"]

        urgency_score = max(0.0, min(1.0, (safety_buf - cover) / float(safety_buf)))

        # Margin Contribution Score
        daily_margin = (item["selling_price"] - item["cost_price"]) * demand
        margin_score = max(0.0, min(1.0, daily_margin / max_daily_margin))

        # Composite Rank: 65% Stockout Urgency, 35% Profit Contribution
        composite_score = (0.65 * urgency_score) + (0.35 * margin_score)

        product_obj = db.query(Product).filter(Product.product_id == item["product_id"]).first()
        sup_name = supplier_map.get(product_obj.supplier_id, "Local Wholesale Mandi") if product_obj else "Wholesaler"

        candidates.append({
            "product_id": item["product_id"],
            "sku": item["sku"],
            "product_name": item["name"],
            "category": item["category"],
            "supplier_name": sup_name,
            "pack_unit": pack_unit,
            "units_per_pack": units_per_pack,
            "recommended_packs": recommended_packs,
            "total_units": total_units,
            "estimated_unit_cost": item["cost_price"],
            "pack_cost": pack_cost,
            "days_of_cover": cover,
            "lead_time_days": lead_time,
            "urgency_score": round(composite_score, 3),
            "stock_on_hand": item["stock_qty"],
            "daily_demand": demand
        })

    # Sort candidates by composite priority descending
    candidates.sort(key=lambda x: x["urgency_score"], reverse=True)

    # 3. Bounded Knapsack Budget Allocation
    allocated_lines = []
    remaining_budget = budget_pkr

    for cand in candidates:
        if remaining_budget <= 0:
            break

        cand_cost = cand["pack_cost"]
        cand_packs = cand["recommended_packs"]
        unit_pack_cost = cand["units_per_pack"] * cand["estimated_unit_cost"]

        if cand_cost <= remaining_budget:
            # Full pack recommendation fits
            allocated_packs = cand_packs
            allocated_cost = cand_cost
        else:
            # Check if reducing pack quantity can fit within remaining budget
            max_packs_possible = int(remaining_budget // unit_pack_cost)
            if max_packs_possible >= 1:
                allocated_packs = max_packs_possible
                allocated_cost = allocated_packs * unit_pack_cost
            else:
                # Cannot fit even 1 pack of this item; continue checking lower-cost items
                continue

        actual_units = allocated_packs * cand["units_per_pack"]
        new_cover = cand["days_of_cover"] + (actual_units / cand["daily_demand"])

        rationale = (
            f"Prioritized due to {cand['days_of_cover']:.1f} days cover vs {cand['lead_time_days']} days lead time. "
            f"Ordering {allocated_packs} {cand['pack_unit']}(s) ({actual_units:.0f} units) extends cover to {new_cover:.1f} days."
        )

        allocated_lines.append({
            "product_id": cand["product_id"],
            "sku": cand["sku"],
            "product_name": cand["product_name"],
            "category": cand["category"],
            "supplier_name": cand["supplier_name"],
            "pack_unit": cand["pack_unit"],
            "units_per_pack": cand["units_per_pack"],
            "recommended_packs": allocated_packs,
            "total_units": actual_units,
            "estimated_unit_cost": cand["estimated_unit_cost"],
            "line_total_cost_pkr": round(allocated_cost, 2),
            "days_of_cover_before": round(cand["days_of_cover"], 1),
            "projected_cover_after": round(new_cover, 1),
            "urgency_score": cand["urgency_score"],
            "rationale": rationale
        })

        remaining_budget -= allocated_cost

    total_spend = sum(line["line_total_cost_pkr"] for line in allocated_lines)

    # Hard guardrail verification
    assert total_spend <= budget_pkr + 0.01, f"Budget exceeded: {total_spend} > {budget_pkr}"

    # 4. Optional: Save draft purchase plan in DB
    plan_id = None
    if save_draft and allocated_lines:
        plan = PurchasePlan(
            store_id=store_id,
            budget=budget_pkr,
            status="draft",
            total_estimated_cost=round(total_spend, 2)
        )
        db.add(plan)
        db.flush()

        for l in allocated_lines:
            pline = PurchasePlanLine(
                plan_id=plan.plan_id,
                product_id=l["product_id"],
                pack_unit=l["pack_unit"],
                recommended_packs=l["recommended_packs"],
                units_per_pack=l["units_per_pack"],
                total_units=l["total_units"],
                estimated_unit_cost=l["estimated_unit_cost"],
                total_cost=l["line_total_cost_pkr"],
                urgency_score=l["urgency_score"],
                rationale=l["rationale"]
            )
            db.add(pline)

        db.commit()
        plan_id = plan.plan_id

    return {
        "plan_id": plan_id,
        "store_id": store_id,
        "budget_entered_pkr": round(budget_pkr, 2),
        "total_allocated_spend_pkr": round(total_spend, 2),
        "remaining_unallocated_pkr": round(budget_pkr - total_spend, 2),
        "total_skus_recommended": len(allocated_lines),
        "data_label": "Demo Data",
        "budget_respected": True,
        "recommendations": allocated_lines
    }
