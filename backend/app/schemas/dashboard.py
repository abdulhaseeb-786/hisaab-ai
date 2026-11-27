from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class ActionItem(BaseModel):
    id: str
    priority: int
    title: str
    category: str  # inventory, margin, credit, cash
    summary: str
    evidence: Dict[str, Any]
    next_step: str
    urgency: str  # critical, high, medium
    image_url: Optional[str] = None
    local_image_url: Optional[str] = None

class TodayActionsResponse(BaseModel):
    store_id: int
    store_name: str
    as_of: datetime
    data_label: str = "Demo Data"
    actions: List[ActionItem]

class KPISummary(BaseModel):
    period: str
    revenue_pkr: float
    cogs_pkr: float
    gross_profit_pkr: float
    gross_margin_pct: float
    inventory_value_at_cost_pkr: float
    receivables_outstanding_pkr: float
    overdue_receivables_pkr: float
    payables_due_7d_pkr: float
    cash_in_hand_pkr: float
    data_label: str = "Demo Data"
