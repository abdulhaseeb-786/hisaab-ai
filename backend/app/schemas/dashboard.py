from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel

from app.schemas.common import DataLabelled

ActionType = Literal["restock", "fix_price", "collect_khata", "clear_dead_stock", "cash_warning"]
Urgency = Literal["critical", "high", "medium", "low"]


class ActionTarget(BaseModel):
    kind: Literal["product", "customer", "cash"]
    id: Optional[int]


class ActionItem(BaseModel):
    id: str
    priority: int
    action_type: ActionType
    urgency: Urgency
    title: str
    summary: str
    next_step: str
    title_ur: str
    summary_ur: str
    next_step_ur: str
    target: ActionTarget
    image_url: Optional[str] = None
    money_at_stake_pkr: float
    money_at_stake_label: str
    # Numbers behind the action. Keys depend on action_type; see analytics/today_actions.py.
    evidence: dict[str, Any]


class TodayActionsResponse(DataLabelled):
    store_id: int
    store_name: str
    as_of: datetime
    ranking_rule: str
    actions: list[ActionItem]


class DailyRevenuePoint(BaseModel):
    date: str
    revenue_pkr: float


class KPISummary(DataLabelled):
    period: Literal["today", "7d", "30d", "90d"]
    period_start: datetime
    period_end: datetime
    revenue_pkr: float
    cogs_pkr: float
    gross_profit_pkr: float
    gross_margin_pct: float
    sales_count: int
    average_basket_pkr: float
    operating_expenses_pkr: float
    previous_revenue_pkr: float
    previous_gross_profit_pkr: float
    revenue_change_pct: Optional[float]
    gross_profit_change_pct: Optional[float]
    inventory_value_at_cost_pkr: float
    products_at_risk_count: int
    out_of_stock_count: int
    out_of_stock_on_order_count: int
    dead_stock_value_pkr: float
    dead_stock_count: int
    receivables_outstanding_pkr: float
    overdue_receivables_pkr: float
    overdue_customers_count: int
    payables_total_pkr: float
    payables_due_7d_pkr: float
    payables_overdue_pkr: float
    cash_in_hand_pkr: float
    daily_revenue: list[DailyRevenuePoint]
