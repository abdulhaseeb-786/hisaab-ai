from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataLabelled, RiskLevel


class ReorderRequest(BaseModel):
    budget_pkr: float = Field(..., gt=0, le=10_000_000, description="Purchase budget in PKR, e.g. 50000")
    store_id: int = 1
    target_cover_days: int = Field(default=14, ge=7, le=60)
    save_draft: bool = Field(default=False, description="Also save the plan as a draft purchase plan")


class PurchasePlanLine(BaseModel):
    product_id: int
    sku: str
    product_name: str
    category: str
    image_url: str
    supplier_id: Optional[int]
    supplier_name: str
    pack_unit: str
    units_per_pack: int
    sell_unit: str
    recommended_packs: int
    needed_packs: int
    is_reduced_by_budget: bool
    total_units: float
    estimated_unit_cost: float
    selling_price: float
    line_total_cost_pkr: float
    stock_on_hand: float
    pending_receipts: float
    daily_demand: float
    lead_time_days: int
    days_of_cover_before: float
    projected_cover_after: float
    stockout_risk: RiskLevel
    urgency_score: float
    profit_score: float
    priority_score: float
    projected_revenue_pkr: float
    projected_gross_profit_pkr: float
    rationale: str
    reasons: list[str]
    reasons_ur: list[str]


class SkippedItem(BaseModel):
    product_id: int
    product_name: str
    needed_packs: int
    pack_unit: str
    cost_of_one_pack_pkr: float
    priority_score: float
    reason: str


class ReorderPlanResponse(DataLabelled):
    plan_id: Optional[int]
    store_id: int
    as_of: datetime
    budget_entered_pkr: float
    target_cover_days: int
    total_allocated_spend_pkr: float
    remaining_unallocated_pkr: float
    budget_used_pct: float
    budget_respected: bool
    total_skus_recommended: int
    items_needing_reorder: int
    items_fully_covered: int
    budget_to_cover_everything_pkr: float
    products_with_unknown_demand: int
    projected_revenue_pkr: float
    projected_gross_profit_pkr: float
    ranking_rule: str
    recommendations: list[PurchasePlanLine]
    skipped: list[SkippedItem]
    skipped_count: int
