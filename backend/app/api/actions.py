from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.analytics.today_actions import RANKING_RULE, get_today_three_actions
from app.core.clock import store_now
from app.core.config import settings
from app.core.database import get_db
from app.schemas.dashboard import TodayActionsResponse

router = APIRouter(prefix="/actions", tags=["Today's Actions"])


@router.get("/today", response_model=TodayActionsResponse)
def get_today_actions(store_id: int = 1, db: Session = Depends(get_db)):
    """Top 3 actions for today, each with evidence and a next step (HOME-01)."""
    now = store_now()
    return {
        "store_id": store_id,
        "store_name": settings.STORE_NAME,
        "as_of": now,
        "ranking_rule": RANKING_RULE,
        "actions": get_today_three_actions(db, store_id=store_id, now=now),
    }
