from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.analytics.cash_outlook import calculate_cash_outlook
from app.schemas.credit import PayablesSummaryResponse

router = APIRouter(prefix="/payables", tags=["Supplier Payables & Cash Outlook"])

@router.get("/summary", response_model=PayablesSummaryResponse)
def get_payables_summary_endpoint(store_id: int = 1, db: Session = Depends(get_db)):
    """GET /api/payables/summary: Supplier balances due in next 7 days (Should requirement)."""
    outlook = calculate_cash_outlook(db, store_id=store_id)
    return {
        "store_id": store_id,
        "as_of": outlook["as_of"],
        "total_payables_pkr": outlook["projected_outflows"]["supplier_payables_due_pkr"],
        "due_next_7_days_pkr": outlook["projected_outflows"]["supplier_payables_due_pkr"],
        "suppliers": outlook["suppliers"],
        "data_label": "Demo Data"
    }

@router.get("/cash-outlook")
def get_cash_outlook_endpoint(days: int = 7, store_id: int = 1, db: Session = Depends(get_db)):
    """GET /api/payables/cash-outlook: 7-day projected cash position (inflows - outflows)."""
    return calculate_cash_outlook(db, store_id=store_id, days_ahead=days)
