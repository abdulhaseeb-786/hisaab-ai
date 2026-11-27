import secrets

from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.schemas.common import DemoResetResponse
from app.simulator.reset import reset_and_seed_database

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/reset", response_model=DemoResetResponse)
def reset_demo(x_demo_key: str = Header(default="")):
    """Rebuild the demo store from the fixed seed (DATA-01). Needs the X-Demo-Key header."""
    if not secrets.compare_digest(x_demo_key, settings.DEMO_RESET_KEY):
        raise HTTPException(status_code=403, detail="Wrong or missing demo key.")
    return reset_and_seed_database(seed=settings.DEMO_DATA_SEED)
