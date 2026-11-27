from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataLabelled, RiskLevel


class ProductPackInfo(BaseModel):
    pack_unit: str
    units_per_pack: int
    sell_unit: str


class ProductResponse(BaseModel):
    product_id: int
    sku: str
    name: str
    category: str
    unit: str
    cost_price: float
    selling_price: float
    margin_pct: float
    stock_qty: float
    stock_value_pkr: float
    lead_time_days: int
    safety_stock_days: int
    supplier_id: Optional[int]
    supplier_name: Optional[str]
    image_url: str
    average_daily_demand: Optional[float]
    units_sold_lookback: float
    lookback_days: int
    days_of_cover: Optional[float]
    effective_cover_days: Optional[float]
    stockout_risk: RiskLevel
    risk_reason: str
    risk_reason_ur: str
    is_out_of_stock: bool
    reorder_point: float
    target_stock: float
    pending_receipts: float
    next_delivery_date: Optional[datetime]
    recommended_order_qty: float
    last_sold_at: Optional[datetime]
    days_since_last_sale: Optional[int]
    is_dead_stock: bool
    pack_info: Optional[ProductPackInfo]


class ProductListResponse(DataLabelled):
    total: int
    counts_by_risk: dict[str, int]
    categories: list[str]
    products: list[ProductResponse]


class PriceChange(BaseModel):
    effective_date: datetime
    cost_price: float
    selling_price: float
    margin_pct: float
    reason: Optional[str]


class StockMovementItem(BaseModel):
    timestamp: datetime
    movement_type: str
    qty_delta: float
    reason: Optional[str]


class ProductDetailResponse(ProductResponse, DataLabelled):
    price_history: list[PriceChange]
    recent_movements: list[StockMovementItem]
    units_sold_30d: float
    revenue_30d_pkr: float
    gross_profit_30d_pkr: float


class PriceUpdateRequest(BaseModel):
    new_selling_price: float = Field(gt=0)
    reason: str = Field(default="Shelf price updated", max_length=120)


class PriceUpdateResponse(BaseModel):
    product_id: int
    old_selling_price: float
    new_selling_price: float
    new_margin_pct: float
    message: str


class StockAdjustmentRequest(BaseModel):
    quantity_change: float = Field(description="Positive for stock received, negative for damage or loss")
    reason: str = Field(default="Stock count", max_length=150)


class StockAdjustmentResponse(BaseModel):
    product_id: int
    old_stock: float
    new_stock: float
    message: str


class MarginSqueezeItem(BaseModel):
    product_id: int
    sku: str
    name: str
    category: str
    image_url: str
    previous_cost_pkr: float
    current_cost_pkr: float
    cost_increase_pkr: float
    cost_increase_pct: float
    shelf_selling_price_pkr: float
    previous_margin_pct: float
    current_margin_pct: float
    margin_drop_pct: float
    recommended_selling_price_pkr: float
    average_daily_demand: Optional[float]
    monthly_profit_at_risk_pkr: float
    cost_changed_on: datetime
    days_since_cost_change: int
    change_reason: Optional[str]
    evidence: str
    recommended_action: str


class DeadStockItem(BaseModel):
    product_id: int
    sku: str
    name: str
    category: str
    image_url: str
    stock_qty: float
    cost_price_pkr: float
    selling_price_pkr: float
    tied_up_capital_pkr: float
    days_since_last_sale: Optional[int]
    last_sold_at: Optional[datetime]
    lookback_days: int
    evidence: str
    recommended_action: str


class InsightsResponse(DataLabelled):
    as_of: datetime
    margin_squeezes: list[MarginSqueezeItem]
    dead_stock: list[DeadStockItem]
    dead_stock_total_pkr: float
    margin_profit_at_risk_pkr: float
