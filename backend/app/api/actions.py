from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.analytics.today_actions import RANKING_RULE, get_today_actions_ranked
from app.core.clock import store_now
from app.core.config import settings
from app.core.database import get_db
from app.schemas.dashboard import TodayActionsResponse

router = APIRouter(prefix="/actions", tags=["Today's Actions"])


@router.get("/today", response_model=TodayActionsResponse)
def get_today_actions(
    store_id: int = 1,
    limit: int = Query(3, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """Top priority actions for today (default 3), each with evidence and a next step (HOME-01)."""
    now = store_now()
    all_actions = get_today_actions_ranked(db, store_id=store_id, now=now)
    return {
        "store_id": store_id,
        "store_name": settings.STORE_NAME,
        "as_of": now,
        "ranking_rule": RANKING_RULE,
        "total_available": len(all_actions),
        "actions": all_actions[:limit],
    }
