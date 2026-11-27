"""Offline copilot (COP-04): works with no internet and no API key.

It reads the question (English or Roman Urdu), picks the matching allow-listed tool,
runs it, and writes the answer from the tool's numbers only. When it cannot tell what
is being asked, it says the data is not available instead of guessing (COP-03).
"""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.analytics.inventory_rules import compute_inventory_health
from app.copilot.tools import execute_tool, find_product

INTENT_KEYWORDS: dict[str, list[str]] = {
    "reorder": ["khareed", "kharid", "buy", "reorder", "budget", "order", "mangwa", "purchase", "stock up", "kya loon", "kya lun"],
    "today": ["aaj", "today", "action", "focus", "zaroori", "zaruri", "priority", "kya karun", "kya karoon", "kaam"],
    "margin": ["margin", "munafa", "profit kam", "price", "qeemat", "rate barh", "mehnga", "loss", "nuqsan", "squeeze"],
    "dead_stock": ["dead", "phasa", "nahi bik", "nahin bik", "slow", "pada", "para hua", "not selling", "stuck"],
    "credit": ["udhaar", "udhar", "khata", "wasooli", "wasuli", "baqaya", "owe", "overdue", "credit", "customer", "qarz"],
    "cash": ["cash", "paisa", "paise", "nakad", "rakam", "raqam", "galla", "drawer", "kitne paise"],
    "payables": ["supplier", "distributor", "payable", "dena hai", "dene", "bill", "invoice", "company ko"],
    "kpi": ["sale", "sales", "revenue", "kamai", "performance", "kitna becha", "business", "kaisa chal", "gross profit"],
    "stock": ["stock", "kitna", "kitne", "bacha", "baqi", "khatam", "left", "remaining", "inventory", "maal"],
}

PERIOD_WORDS = {
    "today": ["aaj", "today"],
    "7d": ["hafta", "hafte", "week", "7 din", "7 day", "7d"],
    "90d": ["3 mahine", "teen mahine", "90 day", "90 din", "quarter"],
}


def parse_budget(text: str) -> float | None:
    """Understand '50000', '50,000', '50k', '50 hazar', '1 lakh', 'Rs 25,000'."""
    t = text.lower().replace(",", "")
    m = re.search(r"(\d+(?:\.\d+)?)\s*(k|hazar|hazaar|thousand|lakh|lac)?\b", t)
    if not m:
        return None
    value = float(m.group(1))
    unit = m.group(2)
    if unit in ("k", "hazar", "hazaar", "thousand"):
        value *= 1_000
    elif unit in ("lakh", "lac"):
        value *= 100_000
    return value if value >= 1_000 else None


def detect_intent(message: str) -> str | None:
    msg = message.lower()
    scores = {intent: sum(1 for k in kws if k in msg) for intent, kws in INTENT_KEYWORDS.items()}
    if parse_budget(msg) and scores["reorder"] == 0 and scores["credit"] == 0 and scores["cash"] == 0:
        scores["reorder"] += 1  # "50,000 mein kya?" is a buying question
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else None


def _money(v: float) -> str:
    return f"Rs {v:,.0f}"


def _reply(text: str, language: str, calls: list[dict[str, Any]], grounded: bool = True) -> dict[str, Any]:
    return {"response": text, "language": language, "tool_calls": calls,
            "provider_used": "offline", "grounded": grounded}


def _call(db: Session, name: str, args: dict[str, Any], store_id: int, calls: list[dict[str, Any]]) -> dict[str, Any]:
    result = execute_tool(db, name, args, store_id=store_id)
    calls.append({"tool_name": name, "parameters": args, "result_summary": _summarise(result)})
    return result


def _summarise(result: dict[str, Any]) -> dict[str, Any]:
    """Small, human-readable summary of a tool result for the 'how I got this' panel."""
    out: dict[str, Any] = {}
    for k, v in result.items():
        if isinstance(v, (int, float, str, bool)) or v is None:
            out[k] = v
        elif isinstance(v, list):
            out[f"{k}_count"] = len(v)
    return dict(list(out.items())[:8])


def run_deterministic_copilot(db: Session, message: str, language: str = "roman_urdu", store_id: int = 1) -> dict[str, Any]:
    ur = language != "english"
    msg = message.lower()
    intent = detect_intent(msg)
    calls: list[dict[str, Any]] = []

    # A product name in a stock question ("Dalda kitna bacha hai?") wins over generic stock.
    if intent in ("stock", None, "today") or (intent == "reorder" and not parse_budget(msg)):
        inv = compute_inventory_health(db, store_id=store_id)
        product = find_product(inv, msg) if any(len(w) > 3 for w in msg.split()) else None
        if product and intent in ("stock", None):
            d = _call(db, "get_product_details", {"product": product["name"]}, store_id, calls)
            if "error" not in d:
                return _reply(_product_text(d, ur), language, calls)

    if intent == "reorder":
        budget = parse_budget(msg) or 50_000.0
        plan = _call(db, "generate_reorder_plan", {"budget_pkr": budget}, store_id, calls)
        return _reply(_plan_text(plan, ur), language, calls)
    if intent == "today":
        return _reply(_today_text(_call(db, "get_today_actions", {}, store_id, calls), ur), language, calls)
    if intent == "margin":
        return _reply(_margin_text(_call(db, "get_margin_insights", {}, store_id, calls), ur), language, calls)
    if intent == "dead_stock":
        return _reply(_dead_text(_call(db, "get_dead_stock", {}, store_id, calls), ur), language, calls)
    if intent == "credit":
        name = _customer_in_message(db, msg, store_id)
        args = {"customer": name} if name else {}
        return _reply(_credit_text(_call(db, "get_credit_summary", args, store_id, calls), ur), language, calls)
    if intent == "cash":
        return _reply(_cash_text(_call(db, "get_cash_outlook", {}, store_id, calls), ur), language, calls)
    if intent == "payables":
        return _reply(_payables_text(_call(db, "get_supplier_payables", {}, store_id, calls), ur), language, calls)
    if intent == "kpi":
        period = next((p for p, words in PERIOD_WORDS.items() if any(w in msg for w in words)), "30d")
        return _reply(_kpi_text(_call(db, "get_store_kpis", {"period": period}, store_id, calls), ur), language, calls)
    if intent == "stock":
        return _reply(_inventory_text(_call(db, "get_inventory_status", {}, store_id, calls), ur), language, calls)

    gap = (
        "Maaf kijiye, is sawal ka jawab dukaan ke records mein nahi hai, is liye main andaza nahi lagaunga. "
        "Aap mujh se stock, khareedari ka budget, munafa (margin), khata/udhaar, cash ya supplier payments ke baare mein pooch sakte hain."
        if ur else
        "Sorry, the shop's records do not have data for that, so I will not guess. "
        "You can ask me about stock, what to buy with a budget, margins, khata, cash, or supplier payments."
    )
    return _reply(gap, language, calls, grounded=True)


def _customer_in_message(db: Session, msg: str, store_id: int) -> str | None:
    from app.models import Customer
    for c in db.query(Customer).filter(Customer.store_id == store_id):
        first = c.name.split()[0].lower()
        if len(first) > 2 and first in msg:
            return first
    return None


# ---- answer templates (numbers come only from tool results) ---------------------------------

def _plan_text(p: dict[str, Any], ur: bool) -> str:
    if "error" in p:
        return p["error"]
    if not p["items"]:
        return ("Is budget mein koi poora pack nahi aata, ya abhi kuch mangwane ki zaroorat nahi."
                if ur else "No whole pack fits this budget, or nothing needs reordering right now.")
    lines = [f"**{_money(p['budget_pkr'])}** ka plan (poore pack, budget se zyada kabhi nahi):\n" if ur
             else f"Plan for **{_money(p['budget_pkr'])}** (whole packs, never over budget):\n"]
    for n, it in enumerate(p["items"][:6], 1):
        lines.append(f"{n}. **{it['name']}**: {it['packs']} {it['pack_unit']} ({it['units']:.0f}) = **{_money(it['cost_pkr'])}**")
        lines.append(f"   {'Wajah' if ur else 'Why'}: {it['why_ur'] if ur else it['why']}")
    more = p["items_in_plan"] - min(6, len(p["items"]))
    if more > 0:
        lines.append(f"\n...aur {more} items." if ur else f"\n...and {more} more items.")
    lines.append(
        f"\n**Kul kharcha:** {_money(p['total_spend_pkr'])} · **Bacha:** {_money(p['left_over_pkr'])}" if ur
        else f"\n**Total:** {_money(p['total_spend_pkr'])} · **Left over:** {_money(p['left_over_pkr'])}"
    )
    if p["budget_to_cover_everything_pkr"] > p["budget_pkr"]:
        lines.append(
            f"Sab {p['items_needing_reorder']} zaroori items poore karne ke liye takreeban {_money(p['budget_to_cover_everything_pkr'])} chahiye." if ur
            else f"Covering all {p['items_needing_reorder']} items that need stock would take about {_money(p['budget_to_cover_everything_pkr'])}."
        )
    return "\n".join(lines)


def _today_text(d: dict[str, Any], ur: bool) -> str:
    acts = d.get("actions", [])
    if not acts:
        return "Aaj koi fori masla nahi. Shabash!" if ur else "Nothing urgent today."
    lines = ["**Aaj ke zaroori kaam:**\n" if ur else "**Today's most important actions:**\n"]
    for a in acts:
        sfx = "_ur" if ur else ""
        lines.append(f"{a['priority']}. **{a['title' + sfx]}**")
        lines.append(f"   {a['summary' + sfx]}")
        lines.append(f"   {'Agla qadam' if ur else 'Next step'}: {a['next_step' + sfx]}")
    return "\n".join(lines)


def _margin_text(d: dict[str, Any], ur: bool) -> str:
    items = d.get("margin_squeezes", [])
    if not items:
        return "Abhi kisi item par margin squeeze nahi mila." if ur else "No margin squeeze found right now."
    lines = ["**Yahan munafa kam ho raha hai:**\n" if ur else "**Where margin is being lost:**\n"]
    for s in items[:4]:
        if ur:
            lines.append(
                f"- **{s['name']}**: cost {_money(s['previous_cost_pkr'])} se {_money(s['current_cost_pkr'])} ho gayi "
                f"({s['cost_changed_on']}), lekin shelf price ab bhi {_money(s['shelf_selling_price_pkr'])} hai. "
                f"Margin {s['previous_margin_pct']}% se {s['current_margin_pct']}%. "
                f"Mashwara: price {_money(s['recommended_selling_price_pkr'])} karein."
            )
        else:
            lines.append(
                f"- **{s['name']}**: cost went from {_money(s['previous_cost_pkr'])} to {_money(s['current_cost_pkr'])} "
                f"on {s['cost_changed_on']}, but the shelf price is still {_money(s['shelf_selling_price_pkr'])}. "
                f"Margin {s['previous_margin_pct']}% → {s['current_margin_pct']}%. "
                f"Suggested price: {_money(s['recommended_selling_price_pkr'])}."
            )
    return "\n".join(lines)


def _dead_text(d: dict[str, Any], ur: bool) -> str:
    items = d.get("items", [])
    if not items:
        return "Koi phasa hua maal nahi mila." if ur else "No dead stock found."
    lines = [f"**Phasa hua maal:** kul {_money(d['total_tied_up_pkr'])} ruka hua hai.\n" if ur
             else f"**Dead stock:** {_money(d['total_tied_up_pkr'])} tied up.\n"]
    for it in items[:5]:
        days = it["days_since_last_sale"]
        when = f"{days} din se" if ur else f"for {days} days"
        lines.append(f"- **{it['name']}**: {it['stock_qty']:.0f} {'pieces' if not ur else 'adad'}, "
                     f"{'koi sale nahi' if ur else 'no sale'} {when} ({_money(it['tied_up_capital_pkr'])})")
    lines.append("\nMashwara: bundle ya 10-15% discount se nikalein, dobara order na karein." if ur
                 else "\nSuggestion: bundle it or give 10-15% off, and do not reorder it.")
    return "\n".join(lines)


def _credit_text(d: dict[str, Any], ur: bool) -> str:
    if "error" in d:
        return d["error"]
    custs = d["customers"]
    if len(custs) == 1 and d.get("overdue_customers") is not None and custs:
        c = custs[0]
        if ur:
            return (f"**{c['name']}** ka khata: kul baqaya **{_money(c['total_balance_pkr'])}**, jis mein "
                    f"**{_money(c['overdue_amount_pkr'])}** overdue hai (purana bill {c['days_overdue']} din late). "
                    f"Safe Mark {c['safe_mark_score']:.0f}/100.")
        return (f"**{c['name']}** owes **{_money(c['total_balance_pkr'])}**, of which **{_money(c['overdue_amount_pkr'])}** "
                f"is overdue (oldest bill {c['days_overdue']} days late). Safe Mark {c['safe_mark_score']:.0f}/100.")
    lines = [
        f"**Kul udhaar:** {_money(d['total_outstanding_pkr'])} · **Overdue:** {_money(d['total_overdue_pkr'])} ({d['overdue_customers']} customers)\n"
        if ur else
        f"**Total khata:** {_money(d['total_outstanding_pkr'])} · **Overdue:** {_money(d['total_overdue_pkr'])} ({d['overdue_customers']} customers)\n"
    ]
    for c in [c for c in custs if c["overdue_amount_pkr"] > 0][:4]:
        lines.append(f"- **{c['name']}**: {_money(c['overdue_amount_pkr'])} overdue, {c['days_overdue']} {'din' if ur else 'days'} "
                     f"(Safe Mark {c['safe_mark_score']:.0f})")
    lines.append("\nPehle sab se purana udhaar wasool karein." if ur else "\nCollect the oldest overdue money first.")
    return "\n".join(lines)


def _cash_text(d: dict[str, Any], ur: bool) -> str:
    low_date = d["lowest_cash_date"]
    low_date = low_date.isoformat() if hasattr(low_date, "isoformat") else low_date
    if ur:
        text = (f"**Galle mein abhi:** {_money(d['cash_in_hand_pkr'])}\n"
                f"Agle 7 din: aamad {_money(d['inflows']['total_inflows_pkr'])}, kharcha {_money(d['outflows']['total_outflows_pkr'])}. "
                f"Hafte ke aakhir mein takreeban **{_money(d['closing_cash_in_7_days_pkr'])}**. "
                f"Sab se kam {_money(d['lowest_cash_pkr'])} ({low_date}).")
        if d["shortfall_warning"]:
            text += "\n⚠️ Cash kam par sakta hai: pehle wasooli karein."
    else:
        text = (f"**Cash in hand:** {_money(d['cash_in_hand_pkr'])}\n"
                f"Next 7 days: {_money(d['inflows']['total_inflows_pkr'])} in, {_money(d['outflows']['total_outflows_pkr'])} out. "
                f"About **{_money(d['closing_cash_in_7_days_pkr'])}** at the end of the week; lowest {_money(d['lowest_cash_pkr'])} on {low_date}.")
        if d["shortfall_warning"]:
            text += "\n⚠️ Cash may run short: collect overdue khata first."
    return text


def _payables_text(d: dict[str, Any], ur: bool) -> str:
    lines = [
        f"**Suppliers ko dena hai:** {_money(d['total_payables_pkr'])} · agle 7 din mein {_money(d['due_next_7_days_pkr'])} · overdue {_money(d['overdue_pkr'])}\n"
        if ur else
        f"**Owed to suppliers:** {_money(d['total_payables_pkr'])} · due in 7 days {_money(d['due_next_7_days_pkr'])} · overdue {_money(d['overdue_pkr'])}\n"
    ]
    for s in d["suppliers"][:5]:
        lines.append(f"- **{s['name']}**: {_money(s['total_payable_pkr'])}" + (f" ({_money(s['overdue_pkr'])} overdue)" if s["overdue_pkr"] else ""))
    return "\n".join(lines)


def _kpi_text(k: dict[str, Any], ur: bool) -> str:
    label = {"today": "Aaj" if ur else "Today", "7d": "Pichle 7 din" if ur else "Last 7 days",
             "30d": "Pichle 30 din" if ur else "Last 30 days", "90d": "Pichle 90 din" if ur else "Last 90 days"}[k["period"]]
    change = k["revenue_change_pct"]
    trend = "" if change is None else (f" ({change:+.1f}% {'pichle arsay se' if ur else 'vs previous period'})")
    if ur:
        return (f"**{label}:** sale {_money(k['revenue_pkr'])}{trend}, gross munafa {_money(k['gross_profit_pkr'])} "
                f"({k['gross_margin_pct']:.1f}%), {k['sales_count']} bills, ausat bill {_money(k['average_basket_pkr'])}.\n"
                "Gross munafa mein kiraya, tankhwah aur bill shamil nahi.")
    return (f"**{label}:** sales {_money(k['revenue_pkr'])}{trend}, gross profit {_money(k['gross_profit_pkr'])} "
            f"({k['gross_margin_pct']:.1f}%), {k['sales_count']} bills, average bill {_money(k['average_basket_pkr'])}.\n"
            "Gross profit does not subtract rent, salaries or bills.")


def _inventory_text(d: dict[str, Any], ur: bool) -> str:
    r = d["by_risk"]
    lines = [
        f"**Stock ka haal:** {r['critical']} khatarnak, {r['high']} kam, {r['medium']} dhyan dein, {r['ok']} theek.\n" if ur
        else f"**Stock status:** {r['critical']} critical, {r['high']} low, {r['medium']} watch, {r['ok']} fine.\n"
    ]
    for it in [i for i in d["items"] if i["risk"] in ("critical", "high", "medium")][:5]:
        lines.append(f"- **{it['name']}**: {it['stock']:.0f} {it['unit']}, {it['days_of_cover']} {'din' if ur else 'days'}. {it['reason_ur'] if ur else it['reason']}")
    return "\n".join(lines)


def _product_text(d: dict[str, Any], ur: bool) -> str:
    cover = d["days_of_cover"]
    cover_txt = f"{cover} {'din' if ur else 'days'}" if cover is not None else ("pata nahi" if ur else "unknown")
    if ur:
        return (f"**{d['name']}**: {d['stock']:.0f} {d['unit']} bacha hai (~{cover_txt}). Rozana takreeban "
                f"{d['daily_demand'] or 0} bikta hai. Agle 7 din ka andaza: {d['next_7_days_forecast_units']:.0f} "
                f"({d['forecast_model']}, quality {d['forecast_quality']}). {d['reason_ur']}")
    return (f"**{d['name']}**: {d['stock']:.0f} {d['unit']} left (~{cover_txt}). Sells about {d['daily_demand'] or 0} a day. "
            f"Next 7 days forecast: {d['next_7_days_forecast_units']:.0f} ({d['forecast_model']}, quality {d['forecast_quality']}). "
            f"{d['reason']}")
