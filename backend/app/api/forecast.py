from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.forecasting.engine import generate_forecast
from app.schemas.forecast import ForecastRequest, ForecastResponse

router = APIRouter(prefix="/forecast", tags=["Demand Forecasting"])


@router.post("", response_model=ForecastResponse)
def get_demand_forecast(request: ForecastRequest, db: Session = Depends(get_db)):
    """Forecast for a product, a category or the whole store, compared with two baselines on held-out days (FC-01..03)."""
    try:
        return generate_forecast(db, store_id=request.store_id, product_id=request.product_id,
                                 category=request.category, horizon_days=request.horizon_days)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
