from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.reorder.budget_optimizer import generate_budget_reorder_plan
from app.schemas.reorder import ReorderRequest, ReorderPlanResponse

router = APIRouter(prefix="/reorder-plan", tags=["Reorder Planner (Hero Flow)"])

@router.post("", response_model=ReorderPlanResponse)
def create_budget_reorder_plan(request: ReorderRequest, db: Session = Depends(get_db)):
    """POST /api/reorder-plan: Answers 'I have PKR 50,000. What should I buy today and why?'
    Guarantees total spend never exceeds budget and rounds to wholesale packs (REC-01 to REC-04).
    """
    try:
        plan = generate_budget_reorder_plan(
            db,
            budget_pkr=request.budget_pkr,
            store_id=request.store_id,
            target_cover_days=request.target_cover_days
        )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
