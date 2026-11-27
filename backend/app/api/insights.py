from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.core.database import get_db
from app.analytics.margin_detector import detect_margin_squeezes
from app.analytics.dead_stock import detect_dead_stock

router = APIRouter(prefix="/insights", tags=["Insights"])

@router.get("")
def get_all_insights(
    insight_type: Optional[str] = Query(default="all", description="Insight filter: all, margin, dead_stock"),
    store_id: int = 1,
    db: Session = Depends(get_db)
):
    """GET /api/insights: Returns margin squeeze and dead-stock insight cards."""
    results = {}
    if insight_type in ("all", "margin"):
        results["margin_squeezes"] = detect_margin_squeezes(db, store_id=store_id)
    if insight_type in ("all", "dead_stock"):
        results["dead_stock"] = detect_dead_stock(db, store_id=store_id)
    return results
