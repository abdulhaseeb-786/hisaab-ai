from pydantic import BaseModel, Field
from typing import List, Optional

class ReorderRequest(BaseModel):
    budget_pkr: float = Field(..., gt=0, description="Purchase budget in PKR (e.g. 50000)")
    store_id: int = 1
    target_cover_days: int = Field(default=14, ge=7, le=60)

class PurchasePlanLineResponse(BaseModel):
    product_id: int
    sku: str
    product_name: str
    category: str
    supplier_name: str
    pack_unit: str
    units_per_pack: int
    recommended_packs: int
    total_units: float
    estimated_unit_cost: float
    line_total_cost_pkr: float
    days_of_cover_before: Optional[float]
    projected_cover_after: Optional[float]
    urgency_score: float
    rationale: str

class ReorderPlanResponse(BaseModel):
    plan_id: Optional[int] = None
    store_id: int
    budget_entered_pkr: float
    total_allocated_spend_pkr: float
    remaining_unallocated_pkr: float
    total_skus_recommended: int
    data_label: str = "Demo Data"
    budget_respected: bool = True
    recommendations: List[PurchasePlanLineResponse]
