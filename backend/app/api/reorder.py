from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.reorder.budget_optimizer import generate_budget_reorder_plan
from app.schemas.reorder import ReorderPlanResponse, ReorderRequest

router = APIRouter(prefix="/reorder-plan", tags=["Reorder Planner (Hero Flow)"])


@router.post("", response_model=ReorderPlanResponse)
def create_budget_reorder_plan(request: ReorderRequest, db: Session = Depends(get_db)):
    """'I have Rs 50,000. What should I buy today and why?' Whole packs, never over budget (REC-01..04)."""
    try:
        return generate_budget_reorder_plan(
            db, budget_pkr=request.budget_pkr, store_id=request.store_id,
            target_cover_days=request.target_cover_days, save_draft=request.save_draft,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
