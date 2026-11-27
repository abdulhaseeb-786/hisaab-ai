from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.kpi_calculator import calculate_kpis
from app.core.database import get_db
from app.schemas.dashboard import KPISummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=KPISummary)
def get_dashboard_kpis(
    period: Literal["today", "7d", "30d", "90d"] = Query(default="30d"),
    store_id: int = 1,
    db: Session = Depends(get_db),
):
    """Sales, gross profit, stock, khata, payables and cash for a period, with the change vs the period before (HOME-02)."""
    return calculate_kpis(db, store_id=store_id, period=period)
