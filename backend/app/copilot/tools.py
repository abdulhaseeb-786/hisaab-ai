"""Allow-listed, read-only tools for the copilot (COP-01, COP-03).

The copilot can only call these functions. Each one runs the same deterministic
analytics the app screens use and returns a compact result. There is no SQL, no code
execution and no write access.
"""

from __future__ import annotations

import difflib
import json
from datetime import date, datetime
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.analytics.cash_outlook import calculate_cash_outlook
from app.analytics.credit_aging import calculate_credit_summary
from app.analytics.dead_stock import detect_dead_stock
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.kpi_calculator import calculate_kpis
from app.analytics.margin_detector import detect_margin_squeezes
from app.analytics.payables import calculate_payables
from app.analytics.today_actions import get_today_three_actions
from app.forecasting.engine import generate_forecast
from app.reorder.budget_optimizer import generate_budget_reorder_plan

MAX_LIST = 8


def _product_brief(i: dict[str, Any]) -> dict[str, Any]:
    return {
        "product_id": i["product_id"], "name": i["name"], "category": i["category"],
        "stock": i["stock_qty"], "unit": i["unit"], "daily_demand": i["average_daily_demand"],
        "days_of_cover": i["days_of_cover"], "lead_time_days": i["lead_time_days"],
        "risk": i["stockout_risk"], "reason": i["risk_reason"], "reason_ur": i["risk_reason_ur"],
        "pending": i["pending_receipts"],
        "cost_pkr": i["cost_price"], "price_pkr": i["selling_price"], "margin_pct": i["margin_pct"],
    }


def find_product(inventory: list[dict[str, Any]], query: str) -> dict[str, Any] | None:
    """Best match for a product name or SKU typed by the shopkeeper."""
    q = query.strip().lower()
    if not q:
        return None
    for i in inventory:
        if i["sku"].lower() == q:
            return i
    words = [w for w in q.replace("-", " ").split() if len(w) > 2]
    scored = []
    for i in inventory:
        name = i["name"].lower()
        hits = sum(1 for w in words if w in name)
        ratio = difflib.SequenceMatcher(None, q, name).ratio()
        scored.append((hits, i["average_daily_demand"] or 0.0, ratio, i))
    # Most matching words first; on a tie, the product people buy most is the one meant
    # ("Dalda" means the 1L pouch everyone buys, not the 5L tin that rarely sells).
    scored.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
    best = scored[0] if scored else None
    if best and (best[0] > 0 or best[2] > 0.55):
        return best[3]
    return None


# ---- tool implementations ----------------------------------------------------------------

def _today_actions(db: Session, store_id: int, **_: Any) -> dict[str, Any]:
    acts = get_today_three_actions(db, store_id=store_id)
    return {"actions": [
        {k: a[k] for k in ("priority", "action_type", "urgency", "title", "summary", "next_step",
                           "title_ur", "summary_ur", "next_step_ur", "money_at_stake_pkr", "money_at_stake_label")}
        for a in acts
    ]}


def _reorder_plan(db: Session, store_id: int, budget_pkr: float = 50000, target_cover_days: int = 14, **_: Any) -> dict[str, Any]:
    budget_pkr = float(budget_pkr)
    if budget_pkr <= 0:
        return {"error": "Budget must be more than zero."}
    target_cover_days = int(min(60, max(7, int(target_cover_days))))
    plan = generate_budget_reorder_plan(db, budget_pkr, store_id=store_id, target_cover_days=target_cover_days)
    return {
        "budget_pkr": plan["budget_entered_pkr"],
        "total_spend_pkr": plan["total_allocated_spend_pkr"],
        "left_over_pkr": plan["remaining_unallocated_pkr"],
        "items": [
            {"name": l["product_name"], "packs": l["recommended_packs"], "pack_unit": l["pack_unit"],
             "units": l["total_units"], "cost_pkr": l["line_total_cost_pkr"],
             "cover_before_days": l["days_of_cover_before"], "cover_after_days": l["projected_cover_after"],
             "why": l["rationale"], "why_ur": " ".join(l["reasons_ur"])}
            for l in plan["recommendations"][:12]
        ],
        "items_in_plan": plan["total_skus_recommended"],
        "items_needing_reorder": plan["items_needing_reorder"],
        "budget_to_cover_everything_pkr": plan["budget_to_cover_everything_pkr"],
        "projected_gross_profit_pkr": plan["projected_gross_profit_pkr"],
        "ranking_rule": plan["ranking_rule"],
    }


def _inventory(db: Session, store_id: int, category: str | None = None, risk: str | None = None, **_: Any) -> dict[str, Any]:
    inv = compute_inventory_health(db, store_id=store_id)
    if category:
        inv = [i for i in inv if category.lower() in i["category"].lower()]
    if risk:
        inv = [i for i in inv if i["stockout_risk"] == risk]
    order = {"critical": 0, "high": 1, "medium": 2, "unknown": 3, "ok": 4}
    inv.sort(key=lambda i: (order.get(i["stockout_risk"], 5), i["effective_cover_days"] or 999))
    return {
        "count": len(inv),
        "by_risk": {r: sum(1 for i in inv if i["stockout_risk"] == r) for r in order},
        "items": [_product_brief(i) for i in inv[:MAX_LIST]],
    }


def _product_details(db: Session, store_id: int, product: str = "", **_: Any) -> dict[str, Any]:
    inv = compute_inventory_health(db, store_id=store_id)
    item = find_product(inv, product)
    if not item:
        return {"error": f"No product matching '{product}' in this store."}
    fc = generate_forecast(db, store_id=store_id, product_id=item["product_id"])
    return {
        **_product_brief(item),
        "next_7_days_forecast_units": fc["total_forecast_units"],
        "forecast_model": fc["model_label"],
        "forecast_quality": fc["quality_label"],
        "days_since_last_sale": item["days_since_last_sale"],
    }


def _margins(db: Session, store_id: int, **_: Any) -> dict[str, Any]:
    return {"margin_squeezes": [
        {k: s[k] for k in ("name", "previous_cost_pkr", "current_cost_pkr", "shelf_selling_price_pkr",
                           "previous_margin_pct", "current_margin_pct", "recommended_selling_price_pkr",
                           "monthly_profit_at_risk_pkr")}
        | {"cost_changed_on": s["cost_changed_on"].date().isoformat()}
        for s in detect_margin_squeezes(db, store_id=store_id)[:MAX_LIST]
    ]}


def _dead_stock(db: Session, store_id: int, **_: Any) -> dict[str, Any]:
    items = detect_dead_stock(db, store_id=store_id)
    return {
        "total_tied_up_pkr": round(sum(d["tied_up_capital_pkr"] for d in items), 0),
        "items": [{k: d[k] for k in ("name", "stock_qty", "days_since_last_sale", "tied_up_capital_pkr")} for d in items[:MAX_LIST]],
    }


def _credit(db: Session, store_id: int, customer: str | None = None, **_: Any) -> dict[str, Any]:
    summary = calculate_credit_summary(db, store_id=store_id)
    customers = summary["customers"]
    if customer:
        names = {c["name"].lower(): c for c in customers}
        match = next((c for n, c in names.items() if customer.lower() in n), None)
        if not match:
            close = difflib.get_close_matches(customer.lower(), list(names), n=1, cutoff=0.5)
            match = names[close[0]] if close else None
        if not match:
            return {"error": f"No customer named '{customer}' has a khata balance."}
        customers = [match]
    return {
        "total_outstanding_pkr": summary["aging"]["total_outstanding_pkr"],
        "total_overdue_pkr": summary["aging"]["total_overdue_pkr"],
        "overdue_customers": summary["total_overdue_customers"],
        "credit_term_days": summary["default_credit_term_days"],
        "customers": [
            {k: c[k] for k in ("name", "total_balance_pkr", "overdue_amount_pkr", "days_overdue",
                               "safe_mark_score", "risk_level", "days_since_last_payment")}
            for c in customers[:MAX_LIST]
        ],
    }


def _kpis(db: Session, store_id: int, period: str = "30d", **_: Any) -> dict[str, Any]:
    k = calculate_kpis(db, store_id=store_id, period=period)
    k.pop("daily_revenue", None)
    return k


def _cash(db: Session, store_id: int, **_: Any) -> dict[str, Any]:
    o = calculate_cash_outlook(db, store_id=store_id)
    return {
        "cash_in_hand_pkr": o["opening_cash_pkr"],
        "closing_cash_in_7_days_pkr": o["projected_closing_cash_pkr"],
        "lowest_cash_pkr": o["lowest_cash_pkr"],
        "lowest_cash_date": o["lowest_cash_date"],
        "shortfall_warning": o["shortfall_warning"],
        "inflows": o["projected_inflows"],
        "outflows": o["projected_outflows"],
        "assumptions": o["assumptions"],
    }


def _payables(db: Session, store_id: int, **_: Any) -> dict[str, Any]:
    p = calculate_payables(db, store_id=store_id)
    return {
        "total_payables_pkr": p["total_payables_pkr"],
        "overdue_pkr": p["overdue_pkr"],
        "due_next_7_days_pkr": p["due_within_horizon_pkr"],
        "suppliers": [
            {k: s[k] for k in ("name", "total_payable_pkr", "overdue_pkr", "due_within_horizon_pkr", "next_due_date")}
            for s in p["suppliers"] if s["total_payable_pkr"] > 0
        ][:MAX_LIST],
    }


TOOLS: dict[str, tuple[Callable[..., dict[str, Any]], str, dict[str, Any]]] = {
    "get_today_actions": (_today_actions, "The 3 most important things to do in the shop today, with evidence.",
                          {"type": "object", "properties": {}}),
    "generate_reorder_plan": (_reorder_plan,
                              "Plan what to buy with a budget in PKR: whole packs, never over budget, with reasons.",
                              {"type": "object", "properties": {
                                  "budget_pkr": {"type": "number", "description": "Budget in Pakistani rupees, e.g. 50000"},
                                  "target_cover_days": {"type": "integer", "description": "Days of stock to aim for (7-60). Default 14."},
                              }, "required": ["budget_pkr"]}),
    "get_inventory_status": (_inventory, "Stock levels, days of cover and stockout risk, optionally for one category or risk level.",
                             {"type": "object", "properties": {
                                 "category": {"type": "string", "description": "e.g. 'Cooking Oil', 'Dairy', 'Spices'"},
                                 "risk": {"type": "string", "enum": ["critical", "high", "medium", "ok", "unknown"]},
                             }}),
    "get_product_details": (_product_details, "Stock, demand, margin and 7-day forecast for one product by name or SKU.",
                            {"type": "object", "properties": {
                                "product": {"type": "string", "description": "Product name or SKU, e.g. 'Dalda 1L'"},
                            }, "required": ["product"]}),
    "get_margin_insights": (_margins, "Products whose supplier cost rose but shelf price did not (margin squeeze).",
                            {"type": "object", "properties": {}}),
    "get_dead_stock": (_dead_stock, "Items on the shelf that have not sold for 30+ days, and money tied up.",
                       {"type": "object", "properties": {}}),
    "get_credit_summary": (_credit, "Customer khata (udhaar): balances, overdue amounts, Safe Mark scores. Optionally one customer.",
                           {"type": "object", "properties": {
                               "customer": {"type": "string", "description": "Customer name, e.g. 'Tariq'"},
                           }}),
    "get_store_kpis": (_kpis, "Sales, gross profit, margin, inventory value, cash, receivables and payables for a period.",
                       {"type": "object", "properties": {
                           "period": {"type": "string", "enum": ["today", "7d", "30d", "90d"]},
                       }}),
    "get_cash_outlook": (_cash, "Cash in hand now and the expected cash for the next 7 days, with assumptions.",
                         {"type": "object", "properties": {}}),
    "get_supplier_payables": (_payables, "Money owed to distributors, overdue and due in the next 7 days.",
                              {"type": "object", "properties": {}}),
}

TOOL_LABELS = {
    "get_today_actions": "Today's actions",
    "generate_reorder_plan": "Reorder planner",
    "get_inventory_status": "Inventory",
    "get_product_details": "Product details",
    "get_margin_insights": "Margin check",
    "get_dead_stock": "Dead stock",
    "get_credit_summary": "Khata",
    "get_store_kpis": "Store numbers",
    "get_cash_outlook": "Cash outlook",
    "get_supplier_payables": "Supplier payables",
}


def tool_declarations() -> list[dict[str, Any]]:
    return [{"name": n, "description": d, "parameters": s} for n, (_, d, s) in TOOLS.items()]


def execute_tool(db: Session, tool_name: str, arguments: dict[str, Any] | None, store_id: int = 1) -> dict[str, Any]:
    """Run one allow-listed tool. Unknown tools are refused."""
    if tool_name not in TOOLS:
        return {"error": f"Unknown tool '{tool_name}'."}
    fn = TOOLS[tool_name][0]
    try:
        return fn(db, store_id, **(arguments or {}))
    except (TypeError, ValueError, LookupError) as exc:
        return {"error": str(exc)}


def to_json(data: Any) -> str:
    def default(o: Any) -> Any:
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return str(o)
    return json.dumps(data, default=default, ensure_ascii=False)
