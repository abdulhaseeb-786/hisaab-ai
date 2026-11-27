from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import DataLabelled

ModelKey = Literal["calendar_smoothing", "last_week_same_day", "moving_average_7d"]


class ForecastRequest(BaseModel):
    product_id: Optional[int] = None
    category: Optional[str] = None
    horizon_days: int = Field(default=7, ge=1, le=30)
    store_id: int = 1

    @model_validator(mode="after")
    def _one_target(self) -> "ForecastRequest":
        if self.product_id and self.category:
            raise ValueError("Give either product_id or category, not both.")
        return self


class DailyForecastPoint(BaseModel):
    date: date
    forecast_units: float
    model_units: float
    baseline_lag7_units: float
    baseline_ma7_units: float
    calendar_label: Optional[str]


class HistoryPoint(BaseModel):
    date: date
    units: float


class ModelScore(BaseModel):
    model: ModelKey
    label: str
    wape_pct: float = Field(description="Average daily error, as % of units sold")
    mae_units: float
    total_error_pct: float = Field(description="Error on the total units over the test window")


class CalendarEffect(BaseModel):
    event: str
    multiplier: float


class UpcomingEvent(BaseModel):
    name: str
    date: str


class ForecastResponse(DataLabelled):
    store_id: int
    target_type: Literal["product", "category", "store"]
    target_id: Optional[int]
    target_name: str
    horizon_days: int
    model_used: ModelKey
    model_label: str
    selection_reason: str
    quality_label: Literal["Good", "Fair", "Low", "Sparse", "Unknown"]
    is_sparse: bool
    quality_reason: str
    evaluation_wape_pct: Optional[float]
    evaluation_total_error_pct: Optional[float]
    evaluation_mae: Optional[float]
    holdout_days: int
    model_comparison: list[ModelScore]
    total_forecast_units: float
    daily_predictions: list[DailyForecastPoint]
    history: list[HistoryPoint]
    weekday_factors: list[float]
    learned_calendar_effects: list[CalendarEffect]
    upcoming_events: list[UpcomingEvent]
