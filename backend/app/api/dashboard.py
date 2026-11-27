from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.analytics.kpi_calculator import calculate_kpis
from app.schemas.dashboard import KPISummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=KPISummary)
def get_dashboard_kpis(
    period: str = Query(default="30d", description="Time period: today, 7d, 30d, 90d, all"),
    store_id: int = 1,
    db: Session = Depends(get_db)
):
    """GET /api/dashboard: Returns store revenue, COGS, gross profit, margin %, and inventory value."""
    return calculate_kpis(db, store_id=store_id, period=period)
