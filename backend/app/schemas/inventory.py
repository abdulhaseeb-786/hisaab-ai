from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

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
    stock_qty: float
    lead_time_days: int
    safety_stock_days: int
    image_url: Optional[str] = None
    local_image_url: Optional[str] = None
    days_of_cover: Optional[float] = None
    stockout_risk: str  # high, medium, safe, unknown
    is_dead_stock: bool = False
    pack_info: Optional[ProductPackInfo] = None

class ProductDetailResponse(ProductResponse):
    pending_receipts: float = 0.0
    pending_receipts_qty: Optional[float] = 0.0
    reorder_point: float
    recommended_order_qty: float
    supplier_name: Optional[str] = None
    recent_price_changes: List[dict] = []

class PriceUpdateRequest(BaseModel):
    new_selling_price: float
    reason: Optional[str] = "Manual store price adjustment"

class StockAdjustmentRequest(BaseModel):
    quantity_change: float
    reason: Optional[str] = "Shopkeeper stock receipt/audit"
