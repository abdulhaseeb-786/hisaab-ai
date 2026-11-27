from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.config import settings
from app.analytics.today_actions import get_today_three_actions
from app.schemas.dashboard import TodayActionsResponse

router = APIRouter(prefix="/actions", tags=["Today's Actions"])

@router.get("/today", response_model=TodayActionsResponse)
def get_today_actions_endpoint(store_id: int = 1, db: Session = Depends(get_db)):
    """GET /api/actions/today: Returns Top 3 ranked actions with evidence (HOME-01)."""
    actions = get_today_three_actions(db, store_id=store_id)
    return {
        "store_id": store_id,
        "store_name": settings.STORE_NAME,
        "as_of": datetime.now(timezone.utc),
        "data_label": "Demo Data",
        "actions": actions
    }
