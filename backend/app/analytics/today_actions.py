"""Today's 3 actions.

Ranking rule (shown on screen):
1. Pick the most urgent problem in each area:
   * Stock: the product whose shortage could lose the most sales before a new delivery.
   * Price: the margin squeeze that loses the most profit per month.
   * Khata: the customer with the most overdue money, weighted by how late it is.
   * Dead stock: the item tying up the most money.
   * Cash: a day in the next week when cash would fall below the safety level.
2. Order them by urgency (critical, then high, then medium), then by area in the order
   above, and keep the first three.

Every action carries structured `evidence` so the app can show the numbers behind it
and phrase it in English or Roman Urdu.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.analytics.cash_outlook import calculate_cash_outlook
from app.analytics.credit_aging import calculate_credit_summary
from app.analytics.dead_stock import detect_dead_stock
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.margin_detector import detect_margin_squeezes
from app.core.clock import store_now

URGENCY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
AREA_ORDER = {"restock": 0, "fix_price": 1, "collect_khata": 2, "clear_dead_stock": 3, "cash_warning": 4}

RANKING_RULE = (
    "The most urgent problem from each area (stock, price, khata, dead stock, cash), "
    "ordered by urgency and then by area. The top three are shown."
)


def _restock_action(inventory: list[dict[str, Any]]) -> dict[str, Any] | None:
    urgent = [i for i in inventory if i["stockout_risk"] in ("critical", "high") and i["average_daily_demand"]]
    if not urgent:
        return None
    def sales_at_risk(i: dict[str, Any]) -> float:
        short = max(0.0, i["lead_time_days"] - (i["effective_cover_days"] or 0))
        return short * i["average_daily_demand"] * i["selling_price"]

    # Biggest money impact first: sales that could be lost before a new delivery arrives.
    item = max(urgent, key=lambda i: (sales_at_risk(i), -(i["effective_cover_days"] or 0)))
    demand = item["average_daily_demand"]
    pack = item["pack_info"] or {"pack_unit": "pack", "units_per_pack": 1}
    packs = max(1, -(-item["recommended_order_qty"] // pack["units_per_pack"]))  # ceil
    days_short = max(0.0, item["lead_time_days"] - (item["effective_cover_days"] or 0))
    lost_sales = round(days_short * demand * item["selling_price"], 0)
    cover = item["days_of_cover"] or 0
    return {
        "id": f"restock-{item['product_id']}",
        "action_type": "restock",
        "urgency": "critical" if item["stockout_risk"] == "critical" else "high",
        "title": f"Reorder {item['name']}",
        "summary": (
            f"Only {item['stock_qty']:.0f} {item['unit']} left, about {cover:.1f} days of sales. "
            f"A new order takes {item['lead_time_days']} days to arrive."
        ),
        "next_step": f"Order {int(packs)} {pack['pack_unit']} from {item['supplier_name'] or 'the supplier'} today.",
        "title_ur": f"{item['name']} fauran mangwayein",
        "summary_ur": (
            f"Sirf {item['stock_qty']:.0f} {item['unit']} bacha hai, takreeban {cover:.1f} din ki sale. "
            f"Naya maal aane mein {item['lead_time_days']} din lagte hain."
        ),
        "next_step_ur": f"Aaj hi {item['supplier_name'] or 'supplier'} se {int(packs)} {pack['pack_unit']} mangwayein.",
        "target": {"kind": "product", "id": item["product_id"]},
        "image_url": item["image_url"],
        "money_at_stake_pkr": lost_sales,
        "money_at_stake_label": "Sales you could lose before the next delivery",
        "evidence": {
            "product_name": item["name"],
            "sku": item["sku"],
            "unit": item["unit"],
            "stock_on_hand": item["stock_qty"],
            "daily_demand": demand,
            "days_of_cover": item["days_of_cover"],
            "lead_time_days": item["lead_time_days"],
            "pending_receipts": item["pending_receipts"],
            "suggested_packs": int(packs),
            "pack_unit": pack["pack_unit"],
            "units_per_pack": pack["units_per_pack"],
            "supplier_name": item["supplier_name"],
        },
    }


def _price_action(squeezes: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not squeezes:
        return None
    sq = squeezes[0]
    return {
        "id": f"fix-price-{sq['product_id']}",
        "action_type": "fix_price",
        "urgency": "high",
        "title": f"Raise the price of {sq['name']}",
        "summary": (
            f"Supplier cost went up Rs {sq['cost_increase_pkr']:,.0f} but the shelf price is still "
            f"Rs {sq['shelf_selling_price_pkr']:,.0f}. Margin fell from {sq['previous_margin_pct']}% to {sq['current_margin_pct']}%."
        ),
        "next_step": f"Change the shelf price to Rs {sq['recommended_selling_price_pkr']:,.0f}.",
        "title_ur": f"{sq['name']} ki qeemat barhayein",
        "summary_ur": (
            f"Supplier ne rate Rs {sq['cost_increase_pkr']:,.0f} barha diya, magar shelf price abhi bhi "
            f"Rs {sq['shelf_selling_price_pkr']:,.0f} hai. Munafa {sq['previous_margin_pct']}% se {sq['current_margin_pct']}% reh gaya."
        ),
        "next_step_ur": f"Shelf price Rs {sq['recommended_selling_price_pkr']:,.0f} kar dein.",
        "target": {"kind": "product", "id": sq["product_id"]},
        "image_url": sq["image_url"],
        "money_at_stake_pkr": sq["monthly_profit_at_risk_pkr"],
        "money_at_stake_label": "Profit lost per month at the old price",
        "evidence": {
            "product_name": sq["name"],
            "sku": sq["sku"],
            "previous_cost_pkr": sq["previous_cost_pkr"],
            "current_cost_pkr": sq["current_cost_pkr"],
            "shelf_price_pkr": sq["shelf_selling_price_pkr"],
            "recommended_price_pkr": sq["recommended_selling_price_pkr"],
            "previous_margin_pct": sq["previous_margin_pct"],
            "current_margin_pct": sq["current_margin_pct"],
            "cost_changed_on": sq["cost_changed_on"].date().isoformat(),
        },
    }


def _khata_action(credit: dict[str, Any]) -> dict[str, Any] | None:
    overdue = credit["top_defaulters"]
    if not overdue:
        return None
    c = overdue[0]
    urgency = "high" if c["days_overdue"] > 30 or c["risk_level"] == "high" else "medium"
    return {
        "id": f"collect-{c['customer_id']}",
        "action_type": "collect_khata",
        "urgency": urgency,
        "title": f"Collect khata from {c['name']}",
        "summary": (
            f"Owes Rs {c['total_balance_pkr']:,.0f}, of which Rs {c['overdue_amount_pkr']:,.0f} is overdue "
            f"(oldest bill {c['days_overdue']} days late). Safe Mark {c['safe_mark_score']:.0f}/100."
        ),
        "next_step": "Send a polite reminder and hold new udhaar until a payment comes in.",
        "title_ur": f"{c['name']} se wasooli karein",
        "summary_ur": (
            f"Kul baqaya Rs {c['total_balance_pkr']:,.0f}, jis mein Rs {c['overdue_amount_pkr']:,.0f} overdue hai "
            f"(purana bill {c['days_overdue']} din late). Safe Mark {c['safe_mark_score']:.0f}/100."
        ),
        "next_step_ur": "Narmi se yaad dihani karein aur payment aane tak naya udhaar rok dein.",
        "target": {"kind": "customer", "id": c["customer_id"]},
        "image_url": None,
        "money_at_stake_pkr": c["overdue_amount_pkr"],
        "money_at_stake_label": "Overdue money",
        "evidence": {
            "customer_name": c["name"],
            "balance_pkr": c["total_balance_pkr"],
            "overdue_pkr": c["overdue_amount_pkr"],
            "days_overdue": c["days_overdue"],
            "safe_mark_score": c["safe_mark_score"],
            "last_payment_date": c["last_payment_date"].date().isoformat() if c["last_payment_date"] else None,
            "credit_limit_pkr": c["credit_limit_pkr"],
        },
    }


def _dead_stock_action(dead: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not dead:
        return None
    d = dead[0]
    return {
        "id": f"dead-stock-{d['product_id']}",
        "action_type": "clear_dead_stock",
        "urgency": "medium",
        "title": f"Clear {d['name']}",
        "summary": d["evidence"],
        "next_step": "Offer it in a bundle or at a small discount, and do not reorder it.",
        "title_ur": f"{d['name']} nikalein",
        "summary_ur": (
            f"{d['days_since_last_sale']} din se koi sale nahi, {d['stock_qty']:.0f} adad shelf par pare hain "
            f"(Rs {d['tied_up_capital_pkr']:,.0f} ruka hua)."
        ),
        "next_step_ur": "Bundle ya thori si discount par bechein, aur dobara order na karein.",
        "target": {"kind": "product", "id": d["product_id"]},
        "image_url": d["image_url"],
        "money_at_stake_pkr": d["tied_up_capital_pkr"],
        "money_at_stake_label": "Money stuck on the shelf",
        "evidence": {
            "product_name": d["name"],
            "sku": d["sku"],
            "stock_qty": d["stock_qty"],
            "days_since_last_sale": d["days_since_last_sale"],
            "tied_up_capital_pkr": d["tied_up_capital_pkr"],
        },
    }


def _cash_action(outlook: dict[str, Any]) -> dict[str, Any] | None:
    if not outlook["shortfall_warning"]:
        return None
    return {
        "id": "cash-warning",
        "action_type": "cash_warning",
        "urgency": "critical" if outlook["lowest_cash_pkr"] < 0 else "high",
        "title": "Cash will run short this week",
        "summary": (
            f"Cash could fall to Rs {outlook['lowest_cash_pkr']:,.0f} on {outlook['lowest_cash_date']:%d %b} "
            "after supplier payments and bills."
        ),
        "next_step": "Collect overdue khata first and ask the distributor for a few extra days.",
        "title_ur": "Is hafte cash kam par sakta hai",
        "summary_ur": (
            f"{outlook['lowest_cash_date']:%d %b} ko cash Rs {outlook['lowest_cash_pkr']:,.0f} tak gir sakta hai, "
            "supplier payments aur bills ke baad."
        ),
        "next_step_ur": "Pehle overdue udhaar wasool karein aur distributor se kuch din ki mohlat lein.",
        "target": {"kind": "cash", "id": None},
        "image_url": None,
        "money_at_stake_pkr": outlook["shortfall_risk_pkr"],
        "money_at_stake_label": "Cash short of the safety level",
        "evidence": {
            "lowest_cash_pkr": outlook["lowest_cash_pkr"],
            "lowest_cash_date": outlook["lowest_cash_date"].isoformat(),
            "safety_cash_pkr": outlook["safety_cash_pkr"],
        },
    }


def get_today_three_actions(db: Session, store_id: int = 1, now: datetime | None = None, limit: int = 3) -> list[dict[str, Any]]:
    now = now or store_now()
    inventory = compute_inventory_health(db, store_id=store_id, now=now)
    candidates = [
        _restock_action(inventory),
        _price_action(detect_margin_squeezes(db, store_id=store_id, inventory=inventory, now=now)),
        _khata_action(calculate_credit_summary(db, store_id=store_id, now=now)),
        _dead_stock_action(detect_dead_stock(db, store_id=store_id, inventory=inventory)),
        _cash_action(calculate_cash_outlook(db, store_id=store_id, now=now)),
    ]
    actions = [a for a in candidates if a]
    actions.sort(key=lambda a: (URGENCY_ORDER[a["urgency"]], AREA_ORDER[a["action_type"]]))
    for rank, a in enumerate(actions[:limit], start=1):
        a["priority"] = rank
    return actions[:limit]
