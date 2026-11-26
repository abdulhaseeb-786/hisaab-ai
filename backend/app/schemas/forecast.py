from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date

class ForecastRequest(BaseModel):
    product_id: Optional[int] = None
    category: Optional[str] = None
    horizon_days: int = Field(default=7, ge=1, le=30)
    store_id: int = 1

class DailyForecastPoint(BaseModel):
    date: date
    forecast_units: float
    baseline_lag7_units: float
    baseline_ma7_units: float

class ForecastResponse(BaseModel):
    store_id: int
    target_type: str  # product or category
    target_id: Optional[int]
    target_name: str
    horizon_days: int
    model_used: str
    quality_label: str  # High, Moderate, Sparse-Fallback
    evaluation_wape_pct: float
    evaluation_mae: float
    daily_predictions: List[DailyForecastPoint]
    data_label: str = "Demo Data"
