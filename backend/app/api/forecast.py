from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.forecasting.engine import generate_forecast
from app.schemas.forecast import ForecastRequest, ForecastResponse

router = APIRouter(prefix="/forecast", tags=["Demand Forecasting"])

@router.post("", response_model=ForecastResponse)
def get_demand_forecast(request: ForecastRequest, db: Session = Depends(get_db)):
    """POST /api/forecast: 7-day forecast with baseline comparison, MAE and WAPE (FC-01, FC-02)."""
    return generate_forecast(
        db,
        store_id=request.store_id,
        product_id=request.product_id,
        category=request.category,
        horizon_days=request.horizon_days
    )
