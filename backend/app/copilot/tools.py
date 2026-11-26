"""Allow-listed read-only analytical tools for the HisaabAI Copilot.
Requirement COP-01, COP-02, COP-03, COP-04:
- Deterministic calculation execution
- Allow-listed functions with typed schemas
- No arbitrary SQL or arbitrary Python code execution
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.analytics import (
    get_today_three_actions,
    compute_inventory_health,
    detect_margin_squeezes,
    detect_dead_stock,
    calculate_credit_summary,
    calculate_cash_outlook,
    calculate_kpis
)
from app.reorder.budget_optimizer import generate_budget_reorder_plan

AVAILABLE_TOOLS_SCHEMA = [
    {
        "name": "get_today_actions",
        "description": "Get the top 3 highest-priority business actions for today with evidence and recommended next steps.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "generate_reorder_plan",
        "description": "Generate a budget-constrained reorder plan for the store in PKR. Answers 'What should I buy today within my budget?'",
        "parameters": {
            "type": "object",
            "properties": {
                "budget_pkr": {"type": "number", "description": "Total purchase budget in Pakistani Rupees (e.g. 50000)"}
            },
            "required": ["budget_pkr"]
        }
    },
    {
        "name": "get_inventory_health",
        "description": "Get inventory stock cover, stockout risk, and fast-moving status across products or categories.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Optional category filter"}
            },
            "required": []
        }
    },
    {
        "name": "get_margin_insights",
        "description": "Get products experiencing a margin squeeze where wholesale supplier cost increased but retail shelf price remained unchanged.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_credit_summary",
        "description": "Get customer khata receivables summary, aging buckets (0-30d, 31-60d, 60d+), overdue list, and Safe Mark credit scores.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "get_store_kpis",
        "description": "Get store gross revenue, COGS, gross profit, margin percentage, and inventory value at cost.",
        "parameters": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "enum": ["today", "7d", "30d", "all"], "description": "Time window for KPIs"}
            },
            "required": []
        }
    }
]

def execute_tool(db: Session, tool_name: str, arguments: Dict[str, Any], store_id: int = 1) -> Dict[str, Any]:
    """Execute allow-listed tool with strict argument dispatching."""
    if tool_name == "get_today_actions":
        return {"actions": get_today_three_actions(db, store_id=store_id)}

    elif tool_name == "generate_reorder_plan":
        budget = float(arguments.get("budget_pkr", 50000.0))
        return generate_budget_reorder_plan(db, budget_pkr=budget, store_id=store_id)

    elif tool_name == "get_inventory_health":
        category = arguments.get("category")
        records = compute_inventory_health(db, store_id=store_id)
        if category:
            records = [r for r in records if category.lower() in r["category"].lower()]
        return {"items": records[:10]}

    elif tool_name == "get_margin_insights":
        return {"margin_squeezes": detect_margin_squeezes(db, store_id=store_id)}

    elif tool_name == "get_credit_summary":
        return calculate_credit_summary(db, store_id=store_id)

    elif tool_name == "get_store_kpis":
        period = arguments.get("period", "30d")
        return calculate_kpis(db, store_id=store_id, period=period)

    else:
        raise ValueError(f"Unknown or unauthorized tool: {tool_name}")
