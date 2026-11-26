"""Deterministic Offline Fallback Engine for HisaabAI Copilot.
Requirement COP-01, COP-02, COP-04, COP-05:
When LLM APIs are unreachable or offline, this engine parses question keywords,
executes the exact backend tool, and generates fluent, grounded responses
in both Roman Urdu and English with zero hallucination.
"""

import re
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.copilot.tools import execute_tool

def run_deterministic_copilot(db: Session, message: str, language: str = "roman_urdu", store_id: int = 1) -> Dict[str, Any]:
    """Pattern-matching deterministic tool executor and natural language generator."""
    msg = message.lower()

    # 1. Hero Flow: Budget Reorder Question
    # Patterns: "50,000", "budget", "kya khareedun", "what should i buy", "reorder"
    budget_match = re.search(r"(\d+[\d,]*)", msg)
    extracted_budget = None
    if budget_match:
        try:
            extracted_budget = float(budget_match.group(1).replace(",", ""))
        except ValueError:
            extracted_budget = None

    if any(k in msg for k in ("khareed", "buy", "reorder", "budget", "order")) or extracted_budget:
        budget = extracted_budget if (extracted_budget and extracted_budget >= 1000) else 50000.0
        plan = execute_tool(db, "generate_reorder_plan", {"budget_pkr": budget}, store_id=store_id)
        
        recs = plan["recommendations"]
        total_spent = plan["total_allocated_spend_pkr"]
        remaining = plan["remaining_unallocated_pkr"]

        tool_execution = {
            "tool_name": "generate_reorder_plan",
            "parameters": {"budget_pkr": budget},
            "result_summary": {
                "budget_entered": budget,
                "total_allocated": total_spent,
                "items_count": len(recs)
            }
        }

        if language == "roman_urdu":
            text_lines = [
                f"Aap ke paas **PKR {budget:,.0f}** ka budget hai. Backend calculation ke mutabiq aap ko yeh saman khareedna chahiye:\n"
            ]
            for i, r in enumerate(recs, 1):
                text_lines.append(
                    f"{i}. **{r['product_name']}**: {r['recommended_packs']} {r['pack_unit']} "
                    f"({r['total_units']:.0f} units) — **PKR {r['line_total_cost_pkr']:,.0f}**\n"
                    f"   *Wajah:* Stock sirf {r['days_of_cover_before']} din ka bacha hai. Is order se cover {r['projected_cover_after']} din ho jaye ga."
                )
            text_lines.append(
                f"\n**Kul Kharcha:** PKR {total_spent:,.0f} | **Baqi Raqam:** PKR {remaining:,.0f}.\n"
                f"*Yeh recommendation aap ke entered budget se kabhi ziyada nahi hogi.*"
            )
            response_text = "\n".join(text_lines)
        else:
            text_lines = [
                f"For your budget of **PKR {budget:,.0f}**, here is the optimal reorder allocation respecting pack sizes:\n"
            ]
            for i, r in enumerate(recs, 1):
                text_lines.append(
                    f"{i}. **{r['product_name']}**: {r['recommended_packs']} {r['pack_unit']}(s) "
                    f"({r['total_units']:.0f} units) — **PKR {r['line_total_cost_pkr']:,.0f}**\n"
                    f"   *Rationale:* On-hand cover is {r['days_of_cover_before']}d. Reorder extends cover to {r['projected_cover_after']}d."
                )
            text_lines.append(
                f"\n**Total Allocated Spend:** PKR {total_spent:,.0f} | **Remaining Buffer:** PKR {remaining:,.0f}."
            )
            response_text = "\n".join(text_lines)

        return {
            "response": response_text,
            "language": language,
            "tool_calls": [tool_execution],
            "provider_used": "deterministic_fallback",
            "grounded": True
        }

    # 2. Today's Actions / Focus
    if any(k in msg for k in ("action", "aaj kya", "today", "focus", "zaruri")):
        actions_data = execute_tool(db, "get_today_actions", {}, store_id=store_id)
        actions = actions_data["actions"]

        tool_execution = {
            "tool_name": "get_today_actions",
            "parameters": {},
            "result_summary": {"actions_count": len(actions)}
        }

        if language == "roman_urdu":
            lines = ["**Aaj ke 3 ahem tareen kam (Today's Actions):**\n"]
            for a in actions:
                lines.append(f"**Priority {a['priority']} ({a['category'].title()}):** {a['title']}")
                lines.append(f"- *Wazahat:* {a['summary']}")
                lines.append(f"- *Agla Qadam:* {a['next_step']}\n")
            response_text = "\n".join(lines)
        else:
            lines = ["**Today's 3 Key Business Actions:**\n"]
            for a in actions:
                lines.append(f"**Priority {a['priority']} ({a['category'].title()}):** {a['title']}")
                lines.append(f"- *Evidence:* {a['summary']}")
                lines.append(f"- *Next Step:* {a['next_step']}\n")
            response_text = "\n".join(lines)

        return {
            "response": response_text,
            "language": language,
            "tool_calls": [tool_execution],
            "provider_used": "deterministic_fallback",
            "grounded": True
        }

    # 3. Margin Squeeze Question
    if any(k in msg for k in ("margin", "munafa", "profit drop", "loss", "price hike", "price")):
        margin_data = execute_tool(db, "get_margin_insights", {}, store_id=store_id)
        squeezes = margin_data["margin_squeezes"]

        tool_execution = {
            "tool_name": "get_margin_insights",
            "parameters": {},
            "result_summary": {"squeezes_found": len(squeezes)}
        }

        if squeezes:
            sq = squeezes[0]
            if language == "roman_urdu":
                response_text = (
                    f"**Margin Alert:** **{sq['name']}** par munafa kam ho gaya hai!\n\n"
                    f"- Wholesale cost PKR {sq['previous_cost_pkr']:.0f} se barh kar **PKR {sq['current_cost_pkr']:.0f}** ho gayi (+PKR {sq['cost_increase_pkr']:.0f}).\n"
                    f"- Magar dukan par selling price abhi bhi **PKR {sq['shelf_selling_price_pkr']:.0f}** hai.\n"
                    f"- Munafa **{sq['previous_margin_pct']}%** se gir kar sirf **{sq['current_margin_pct']}%** reh gaya hai.\n\n"
                    f"👉 **Mashwara:** Naye rate ke mutabiq shelf price foran **PKR {sq['recommended_selling_price_pkr']:.0f}** kar dein taake apna munafa mehfooz rakh sakein."
                )
            else:
                response_text = (
                    f"**Margin Squeeze Detected on {sq['name']}:**\n\n"
                    f"- Wholesale cost rose from PKR {sq['previous_cost_pkr']:.0f} to **PKR {sq['current_cost_pkr']:.0f}** (+PKR {sq['cost_increase_pkr']:.0f}).\n"
                    f"- Shelf price remained unchanged at **PKR {sq['shelf_selling_price_pkr']:.0f}**.\n"
                    f"- Gross margin dropped from **{sq['previous_margin_pct']}%** down to **{sq['current_margin_pct']}%**.\n\n"
                    f"👉 **Next Step:** Update shelf price tag to **PKR {sq['recommended_selling_price_pkr']:.0f}** to restore target margin."
                )
        else:
            response_text = "Filhal kisi product par margin squeeze detect nahi hua." if language == "roman_urdu" else "No margin squeeze detected across products."

        return {
            "response": response_text,
            "language": language,
            "tool_calls": [tool_execution],
            "provider_used": "deterministic_fallback",
            "grounded": True
        }

    # 4. Credit / Khata Question
    if any(k in msg for k in ("udhaar", "credit", "khata", "wasooli", "baqaya", "debt", "owe", "overdue", "customer")):
        credit_data = execute_tool(db, "get_credit_summary", {}, store_id=store_id)
        aging = credit_data["aging"]
        top_def = credit_data["top_defaulters"]

        tool_execution = {
            "tool_name": "get_credit_summary",
            "parameters": {},
            "result_summary": {"total_receivables": aging["total_outstanding_pkr"]}
        }

        if language == "roman_urdu":
            lines = [
                f"**Customer Khata Summary:**\n",
                f"- Kul Baqaya Udhaar: **PKR {aging['total_outstanding_pkr']:,.0f}**",
                f"- 30 Din se Ziyada Overdue: **PKR {aging['overdue_31_60_days_pkr'] + aging['overdue_61_plus_days_pkr']:,.0f}**\n",
                f"**Wasooli ke liye Top Customers:**"
            ]
            for c in top_def[:3]:
                lines.append(f"- **{c['name']}**: PKR {c['total_balance_pkr']:,.0f} ({c['days_overdue']} din overdue, Safe Mark: {c['safe_mark_score']:.0f}/100)")
            lines.append("\n👉 **Mashwara:** In customers ko mazeed udhaar dene se pehle pichli wasooli karein.")
            response_text = "\n".join(lines)
        else:
            lines = [
                f"**Customer Receivables & Khata Summary:**\n",
                f"- Total Outstanding Credit: **PKR {aging['total_outstanding_pkr']:,.0f}**",
                f"- Overdue (>30 Days): **PKR {aging['overdue_31_60_days_pkr'] + aging['overdue_61_plus_days_pkr']:,.0f}**\n",
                f"**Priority Collection Follow-ups:**"
            ]
            for c in top_def[:3]:
                lines.append(f"- **{c['name']}**: PKR {c['total_balance_pkr']:,.0f} ({c['days_overdue']} days past due | Safe Mark: {c['safe_mark_score']:.0f}/100)")
            response_text = "\n".join(lines)

        return {
            "response": response_text,
            "language": language,
            "tool_calls": [tool_execution],
            "provider_used": "deterministic_fallback",
            "grounded": True
        }

    # 5. General Store Performance / KPIs
    if any(k in msg for k in ("sale", "kpi", "performance", "revenue", "gross profit", "income")):
        kpi_data = execute_tool(db, "get_store_kpis", {"period": "30d"}, store_id=store_id)
        tool_execution = {
            "tool_name": "get_store_kpis",
            "parameters": {"period": "30d"},
            "result_summary": {"revenue": kpi_data["revenue_pkr"], "profit": kpi_data["gross_profit_pkr"]}
        }

        if language == "roman_urdu":
            response_text = (
                f"**Dukan ki Pichle 30 Din ki Performance:**\n\n"
                f"- Kul Sale (Revenue): **PKR {kpi_data['revenue_pkr']:,.0f}**\n"
                f"- COGS (Maal ki khareed): **PKR {kpi_data['cogs_pkr']:,.0f}**\n"
                f"- Gross Munafa (Profit): **PKR {kpi_data['gross_profit_pkr']:,.0f}**\n"
                f"- Munafa Sharah (Margin %): **{kpi_data['gross_margin_pct']:.1f}%**\n"
                f"- Dukan mein mojood maal ki qeemat: **PKR {kpi_data['inventory_value_at_cost_pkr']:,.0f}**"
            )
        else:
            response_text = (
                f"**Store 30-Day Financial Performance:**\n\n"
                f"- Gross Revenue: **PKR {kpi_data['revenue_pkr']:,.0f}**\n"
                f"- COGS: **PKR {kpi_data['cogs_pkr']:,.0f}**\n"
                f"- Gross Profit: **PKR {kpi_data['gross_profit_pkr']:,.0f}**\n"
                f"- Gross Margin: **{kpi_data['gross_margin_pct']:.1f}%**\n"
                f"- Inventory Value at Cost: **PKR {kpi_data['inventory_value_at_cost_pkr']:,.0f}**"
            )

        return {
            "response": response_text,
            "language": language,
            "tool_calls": [tool_execution],
            "provider_used": "deterministic_fallback",
            "grounded": True
        }

    # Default / Unknown Data Gap Handling (Requirement COP-05)
    if language == "roman_urdu":
        gap_text = (
            "Maaf kijiye, aap ke is sawal ka data store records mein mojood nahi hai. "
            "Aap mujh se dukan ke stock, budget khareedari (reorder plan), margin squeeze, "
            "ya customer udhaar khata ke mutaliq pooch sakte hain."
        )
    else:
        gap_text = (
            "I could not find recorded data for this specific query. "
            "You can ask me about stockout risks, budget purchasing recommendations, "
            "margin drops, or customer credit summaries."
        )

    return {
        "response": gap_text,
        "language": language,
        "tool_calls": [],
        "provider_used": "deterministic_fallback",
        "grounded": True
    }
