"""Hero flow: "I have Rs 50,000. What should I buy today, and why?"

Rules (REC-01..04), all visible to the shopkeeper:

1. Need: for every product with known demand,
       need = daily demand x (lead time + target cover days) - stock - orders on the way.
2. Packs: the need is rounded UP to whole wholesale packs (carton, bori, crate), and at
   least the supplier's minimum order (MOQ).
3. Priority score (0-1) = 0.65 x urgency + 0.35 x profit contribution, where
       urgency = how far effective cover is below (lead time + safety days), 0..1
       profit contribution = daily gross profit of the item / the best item's, 0..1
4. Budget fill, in two passes down the priority list:
   a. Protect: buy just enough whole packs of each item to last until a new delivery
      can arrive plus a few safety days (lead time + safety days + 3).
   b. Top up: with the money left, raise items to the full target cover.
   If a pack does not fit, the item gets as many whole packs as fit (never below the
   MOQ); if none fit, it is listed as skipped with the reason.
   Slow sellers whose smallest order would last more than 45 days have their score cut
   to 30%, so a whole carton of something that barely sells does not eat the budget.
5. The total never exceeds the budget. This is checked in code and in tests.
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.analytics.inventory_rules import compute_inventory_health
from app.core.clock import store_now
from app.models import PurchasePlan, PurchasePlanLine, SupplierProduct
from app.core.wording import days

URGENCY_WEIGHT = 0.65
PROFIT_WEIGHT = 0.35

PROTECT_EXTRA_DAYS = 3
# A slow seller whose smallest order would last longer than this is bought last.
OVERSTOCK_DAYS = 45
OVERSTOCK_PENALTY = 0.3

RANKING_RULE = (
    "Score = 65% urgency (how soon it runs out compared with the supplier's delivery time) "
    "+ 35% profit (how much gross profit it earns per day). First, every item at risk gets "
    "enough whole packs to last until the next delivery; then the money left tops up the "
    "highest-scoring items to the full target cover. Slow sellers whose smallest pack would "
    "last over 45 days are bought last."
)


def _urgency(effective_cover: float, lead: int, safety: int) -> float:
    buffer_days = lead + safety
    return max(0.0, min(1.0, (buffer_days - effective_cover) / buffer_days))


def generate_budget_reorder_plan(
    db: Session,
    budget_pkr: float,
    store_id: int = 1,
    target_cover_days: int = 14,
    save_draft: bool = False,
    now: datetime | None = None,
    supplier_id: int | None = None,
) -> dict[str, Any]:
    """`supplier_id` limits the plan to one distributor: what to order from the booker at the counter."""
    if budget_pkr <= 0:
        raise ValueError("Budget must be greater than zero.")
    now = now or store_now()

    inventory = compute_inventory_health(db, store_id=store_id, target_cover_days=target_cover_days, now=now)
    moq_by_product = {sp.product_id: sp.moq or 1 for sp in db.query(SupplierProduct)}

    if supplier_id is not None:
        inventory = [i for i in inventory if i["supplier_id"] == supplier_id]
    needing = [i for i in inventory if i["average_daily_demand"] and i["recommended_order_qty"] > 0]
    unknown_demand = sum(1 for i in inventory if i["average_daily_demand"] is None and not i["is_dead_stock"])
    best_daily_profit = max(
        ((i["selling_price"] - i["cost_price"]) * i["average_daily_demand"] for i in needing), default=1.0
    ) or 1.0

    candidates = []
    for item in needing:
        demand = item["average_daily_demand"]
        pack = item["pack_info"] or {"pack_unit": "pack", "units_per_pack": 1, "sell_unit": item["unit"]}
        per_pack = max(1, pack["units_per_pack"])
        moq = moq_by_product.get(item["product_id"], 1)
        packs = max(moq, math.ceil(item["recommended_order_qty"] / per_pack))
        protect_units = (
            demand * (item["lead_time_days"] + item["safety_stock_days"] + PROTECT_EXTRA_DAYS)
            - item["stock_qty"] - item["pending_receipts"]
        )
        protect_packs = min(packs, max(moq, math.ceil(protect_units / per_pack))) if protect_units > 0 else 0
        effective = item["effective_cover_days"] or 0.0
        urgency = _urgency(effective, item["lead_time_days"], item["safety_stock_days"])
        daily_profit = (item["selling_price"] - item["cost_price"]) * demand
        profit_score = max(0.0, min(1.0, daily_profit / best_daily_profit))
        score = URGENCY_WEIGHT * urgency + PROFIT_WEIGHT * profit_score
        smallest_order_cover = (item["stock_qty"] + item["pending_receipts"] + moq * per_pack) / demand
        overstock = smallest_order_cover > OVERSTOCK_DAYS
        if overstock:
            score *= OVERSTOCK_PENALTY
        candidates.append({
            "item": item,
            "packs": packs,
            "protect_packs": protect_packs,
            "per_pack": per_pack,
            "pack": pack,
            "moq": moq,
            "pack_cost": per_pack * item["cost_price"],
            "urgency": urgency,
            "profit_score": profit_score,
            "score": score,
            "overstock": overstock,
            "smallest_order_cover": smallest_order_cover,
        })
    candidates.sort(key=lambda c: c["score"], reverse=True)

    remaining = float(budget_pkr)
    allocated: dict[int, int] = {}

    def buy(c: dict[str, Any], wanted: int) -> None:
        """Buy up to `wanted` more packs of candidate c with the money left."""
        nonlocal remaining
        if wanted <= 0:
            return
        already = allocated.get(c["item"]["product_id"], 0)
        packs = min(wanted, int((remaining + 1e-6) // c["pack_cost"]))
        if packs <= 0 or (already == 0 and packs < c["moq"]):
            return
        allocated[c["item"]["product_id"]] = already + packs
        remaining -= packs * c["pack_cost"]

    for c in candidates:  # pass a: protect against stockouts (slow sellers wait for pass b)
        if not c["overstock"]:
            buy(c, c["protect_packs"])
    for c in candidates:  # pass b: top up to the full target cover
        buy(c, c["packs"] - allocated.get(c["item"]["product_id"], 0))

    lines: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for c in candidates:
        item = c["item"]
        packs = allocated.get(item["product_id"], 0)
        if packs == 0:
            skipped.append({
                "product_id": item["product_id"],
                "product_name": item["name"],
                "needed_packs": c["packs"],
                "pack_unit": c["pack"]["pack_unit"],
                "cost_of_one_pack_pkr": round(c["pack_cost"], 2),
                "priority_score": round(c["score"], 3),
                "reason": "Budget ran out before this item",
            })
            continue
        reduced = packs < c["packs"]
        units = packs * c["per_pack"]
        cost = round(packs * c["pack_cost"], 2)
        demand = item["average_daily_demand"]
        cover_before = item["days_of_cover"] or 0.0
        cover_after = (item["stock_qty"] + item["pending_receipts"] + units) / demand
        unit_profit = item["selling_price"] - item["cost_price"]
        why = [
            f"{cover_before:.1f} days of stock left; supplier needs {days(item['lead_time_days'])} to deliver.",
            f"Sells about {demand:.1f} {item['unit']} a day (last {item['lookback_days']} days).",
        ]
        why_ur = [
            f"Stock {cover_before:.1f} din ka hai; supplier {item['lead_time_days']} din mein maal deta hai.",
            f"Rozana takreeban {demand:.1f} {item['unit']} bikta hai (pichle {item['lookback_days']} din).",
        ]
        if item["pending_receipts"] > 0:
            why.append(f"{item['pending_receipts']:.0f} {item['unit']} already on the way are counted.")
            why_ur.append(f"{item['pending_receipts']:.0f} {item['unit']} pehle se raste mein hain, woh shamil hain.")
        if c["overstock"]:
            why.append(
                f"Sells slowly: even one {c['pack']['pack_unit']} lasts {c['smallest_order_cover']:.0f} days, "
                "so it is bought after faster items."
            )
            why_ur.append(
                f"Aahista bikta hai: ek {c['pack']['pack_unit']} bhi {c['smallest_order_cover']:.0f} din chalega, "
                "is liye tez bikne wale items pehle."
            )
        if reduced:
            why.append(f"Budget allowed {packs} of the {c['packs']} {c['pack']['pack_unit']} needed for full cover.")
            why_ur.append(f"Budget mein {c['packs']} mein se {packs} {c['pack']['pack_unit']} aaye.")
        why.append(f"After this order: about {cover_after:.0f} days of stock.")
        why_ur.append(f"Is order ke baad takreeban {cover_after:.0f} din ka stock.")
        lines.append({
            "product_id": item["product_id"],
            "sku": item["sku"],
            "product_name": item["name"],
            "category": item["category"],
            "image_url": item["image_url"],
            "supplier_id": item["supplier_id"],
            "supplier_name": item["supplier_name"] or "Local wholesaler",
            "pack_unit": c["pack"]["pack_unit"],
            "units_per_pack": c["per_pack"],
            "sell_unit": c["pack"]["sell_unit"],
            "recommended_packs": packs,
            "needed_packs": c["packs"],
            "is_reduced_by_budget": reduced,
            "total_units": float(units),
            "estimated_unit_cost": item["cost_price"],
            "selling_price": item["selling_price"],
            "line_total_cost_pkr": cost,
            "stock_on_hand": item["stock_qty"],
            "pending_receipts": item["pending_receipts"],
            "daily_demand": demand,
            "lead_time_days": item["lead_time_days"],
            "days_of_cover_before": round(cover_before, 1),
            "projected_cover_after": round(cover_after, 1),
            "stockout_risk": item["stockout_risk"],
            "urgency_score": round(c["urgency"], 3),
            "profit_score": round(c["profit_score"], 3),
            "priority_score": round(c["score"], 3),
            "projected_revenue_pkr": round(units * item["selling_price"], 0),
            "projected_gross_profit_pkr": round(units * unit_profit, 0),
            "rationale": " ".join(why),
            "reasons": why,
            "reasons_ur": why_ur,
        })

    total = round(sum(l["line_total_cost_pkr"] for l in lines), 2)
    if total > budget_pkr + 0.01:  # hard guardrail; must never happen
        raise RuntimeError(f"Budget exceeded: {total} > {budget_pkr}")

    plan_id = None
    if save_draft and lines:
        plan = PurchasePlan(store_id=store_id, budget=budget_pkr, status="draft", total_estimated_cost=total)
        db.add(plan)
        db.flush()
        for l in lines:
            db.add(PurchasePlanLine(
                plan_id=plan.plan_id, product_id=l["product_id"], pack_unit=l["pack_unit"],
                recommended_packs=l["recommended_packs"], units_per_pack=l["units_per_pack"],
                total_units=l["total_units"], estimated_unit_cost=l["estimated_unit_cost"],
                total_cost=l["line_total_cost_pkr"], urgency_score=l["priority_score"],
                rationale=l["rationale"][:300],
            ))
        db.commit()
        plan_id = plan.plan_id

    fully_covered = sum(1 for l in lines if not l["is_reduced_by_budget"])
    return {
        "plan_id": plan_id,
        "store_id": store_id,
        "as_of": now,
        "budget_entered_pkr": round(budget_pkr, 2),
        "target_cover_days": target_cover_days,
        "total_allocated_spend_pkr": total,
        "remaining_unallocated_pkr": round(budget_pkr - total, 2),
        "budget_used_pct": round(total / budget_pkr * 100, 1),
        "budget_respected": True,
        "total_skus_recommended": len(lines),
        "items_needing_reorder": len(candidates),
        "items_fully_covered": fully_covered,
        "budget_to_cover_everything_pkr": round(sum(c["packs"] * c["pack_cost"] for c in candidates), 0),
        "products_with_unknown_demand": unknown_demand,
        "projected_revenue_pkr": round(sum(l["projected_revenue_pkr"] for l in lines), 0),
        "projected_gross_profit_pkr": round(sum(l["projected_gross_profit_pkr"] for l in lines), 0),
        "ranking_rule": RANKING_RULE,
        "recommendations": lines,
        "skipped": skipped[:15],
        "skipped_count": len(skipped),
    }
