from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.core.config import settings

RiskLevel = Literal["critical", "high", "medium", "ok", "unknown"]


class DataLabelled(BaseModel):
    """Every response that carries store numbers says where they came from."""

    data_label: str = Field(default_factory=lambda: settings.DEMO_DATA_LABEL)


class StoreProfile(DataLabelled):
    store_id: int
    name: str
    location: Optional[str]
    owner_name: Optional[str]
    currency: str
    timezone: str
    default_credit_term_days: int
    as_of: datetime
    data_start: Optional[date]
    data_end: Optional[date]
    seed: Optional[int]
    product_count: int
    customer_count: int
    supplier_count: int
    copilot: "CopilotStatus"


class CopilotStatus(BaseModel):
    mode: str
    gemini_configured: bool
    groq_configured: bool
    offline_available: bool


class MessageResponse(BaseModel):
    message: str


class DemoResetResponse(DataLabelled):
    store_id: int
    store_name: str
    seed: int
    data_start: date
    data_end: date
    products: int
    sales: int
    sale_lines: int
    customers: int
    purchases: int
    seconds: float


StoreProfile.model_rebuild()
