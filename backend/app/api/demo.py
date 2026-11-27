from fastapi import APIRouter, Header, HTTPException
from app.simulator.reset import reset_and_seed_database

router = APIRouter(prefix="/demo", tags=["Demo Administration"])

@router.post("/reset")
def reset_demo_database(x_demo_key: str = Header(default="cye2026")):
    """POST /api/demo/reset: Reset database to deterministic Seed 42 digital twin."""
    if x_demo_key != "cye2026":
        raise HTTPException(status_code=403, detail="Unauthorized demo reset request.")
    return reset_and_seed_database(seed=42)
