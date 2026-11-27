from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics.dead_stock import detect_dead_stock
from app.analytics.inventory_rules import compute_inventory_health
from app.analytics.margin_detector import detect_margin_squeezes
from app.core.clock import store_now
from app.core.database import get_db
from app.schemas.inventory import InsightsResponse

router = APIRouter(prefix="/insights", tags=["Insights"])


@router.get("", response_model=InsightsResponse)
def get_insights(store_id: int = 1, db: Session = Depends(get_db)):
    """Margin squeezes (PROF-01) and dead stock (INV-03), with evidence."""
    now = store_now()
    inventory = compute_inventory_health(db, store_id=store_id, now=now)
    squeezes = detect_margin_squeezes(db, store_id=store_id, inventory=inventory, now=now)
    dead = detect_dead_stock(db, store_id=store_id, inventory=inventory)
    return {
        "as_of": now,
        "margin_squeezes": squeezes,
        "dead_stock": dead,
        "dead_stock_total_pkr": round(sum(d["tied_up_capital_pkr"] for d in dead), 0),
        "margin_profit_at_risk_pkr": round(sum(s["monthly_profit_at_risk_pkr"] for s in squeezes), 0),
    }
