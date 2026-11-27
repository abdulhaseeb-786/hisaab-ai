"""Reset the database and seed the demo store.

Run from the backend folder:  python -m app.simulator.reset
"""

from __future__ import annotations

import logging
import time

from sqlalchemy import inspect, select

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.clock import store_today
from app.simulator.seed_generator import SCHEMA_VERSION, seed_store_digital_twin

logger = logging.getLogger(__name__)


def reset_and_seed_database(seed: int | None = None) -> dict:
    """Drop every table, recreate the schema and seed the deterministic demo store."""
    import app.models  # noqa: F401  (register all models)
    from app.models import AppMeta  # noqa: F401

    seed = settings.DEMO_DATA_SEED if seed is None else seed
    started = time.perf_counter()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        summary = seed_store_digital_twin(db, seed=seed)
    finally:
        db.close()
    summary["seconds"] = round(time.perf_counter() - started, 2)
    summary["data_label"] = settings.DEMO_DATA_LABEL
    logger.info("Demo store seeded: %s", summary)
    return summary


def demo_data_status() -> dict:
    """Why (or whether) the demo data needs a refresh: missing, old schema, or stale."""
    import app.models  # noqa: F401
    from app.models import AppMeta

    if "app_meta" not in inspect(engine).get_table_names():
        return {"needs_reset": True, "reason": "no demo data yet"}
    db = SessionLocal()
    try:
        meta = {row.key: row.value for row in db.execute(select(AppMeta)).scalars()}
    finally:
        db.close()
    if meta.get("schema_version") != SCHEMA_VERSION:
        return {"needs_reset": True, "reason": f"schema {meta.get('schema_version')} != {SCHEMA_VERSION}"}
    if meta.get("data_end") != store_today().isoformat():
        return {"needs_reset": True, "reason": f"data ends {meta.get('data_end')}, today is {store_today()}"}
    return {"needs_reset": False, "reason": "up to date", **meta}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(reset_and_seed_database())
