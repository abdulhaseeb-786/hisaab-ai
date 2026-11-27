import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.main import app
from app.simulator.reset import reset_and_seed_database

@pytest.fixture(scope="session", autouse=True)
def seed_test_database():
    reset_and_seed_database(seed=42)

@pytest.fixture(scope="session")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
