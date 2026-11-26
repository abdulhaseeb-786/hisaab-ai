"""Database reset and deterministic seeding utility."""

import logging
from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.simulator.seed_generator import seed_store_digital_twin

logger = logging.getLogger(__name__)

def reset_and_seed_database(seed: int = 42) -> dict:
    """Drop all tables, recreate them, and seed the deterministic Pakistani store digital twin."""
    logger.info(f"Resetting database with seed {seed}...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        store = seed_store_digital_twin(db, seed=seed)
        logger.info(f"Store '{store.name}' successfully seeded!")
        return {
            "status": "success",
            "message": "Database reset and seeded with deterministic Pakistani retail digital twin.",
            "store_id": store.store_id,
            "store_name": store.name,
            "seed_used": seed,
            "data_label": "Demo Data"
        }
    finally:
        db.close()

if __name__ == "__main__":
    result = reset_and_seed_database(42)
    print(result)
