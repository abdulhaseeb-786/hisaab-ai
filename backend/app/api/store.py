from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.copilot.llm_client import provider_status
from app.core.clock import store_now
from app.core.database import get_db
from app.models import AppMeta, Customer, Product, Store, Supplier
from app.schemas.common import StoreProfile

router = APIRouter(prefix="/store", tags=["Store"])


@router.get("", response_model=StoreProfile)
def get_store_profile(store_id: int = 1, db: Session = Depends(get_db)):
    """The store's name, location and data window, so the app never hard-codes them."""
    store = db.get(Store, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found.")
    meta = {m.key: m.value for m in db.execute(select(AppMeta)).scalars()}

    def count(model) -> int:
        return db.query(func.count()).select_from(model).filter(model.store_id == store_id).scalar() or 0

    return {
        "store_id": store.store_id,
        "name": store.name,
        "location": store.location,
        "owner_name": store.owner_name,
        "currency": store.currency,
        "timezone": store.timezone,
        "default_credit_term_days": store.default_credit_term_days,
        "as_of": store_now(),
        "data_start": meta.get("data_start"),
        "data_end": meta.get("data_end"),
        "seed": int(meta["seed"]) if "seed" in meta else None,
        "product_count": count(Product),
        "customer_count": count(Customer),
        "supplier_count": count(Supplier),
        "copilot": provider_status(),
    }
