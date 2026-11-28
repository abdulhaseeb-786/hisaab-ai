"""Test setup.

The suite runs against its own temporary SQLite file, never the app's database. The
environment variables are set before any app module is imported, because settings are
read at import time.
"""

import os
import sys
import tempfile
from pathlib import Path

_TMP_DIR = tempfile.mkdtemp(prefix="hisaabai-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP_DIR, 'test.db').as_posix()}"
os.environ["COPILOT_MODE"] = "offline"
os.environ["GEMINI_API_KEY"] = ""
os.environ["GROQ_API_KEY"] = ""
os.environ["DEMO_AUTO_REFRESH"] = "false"
os.environ["VOICE_DIR"] = str(Path(_TMP_DIR, "voice"))

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.simulator.reset import reset_and_seed_database  # noqa: E402

assert "hisaab_ai.db" not in settings.DATABASE_URL, "tests must never use the app database"


@pytest.fixture(scope="session", autouse=True)
def seeded_database():
    return reset_and_seed_database(seed=42)


@pytest.fixture()
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


@pytest.fixture()
def reseed():
    """For tests that change data: give them a fresh store and restore it afterwards."""
    reset_and_seed_database(seed=42)
    yield
    reset_and_seed_database(seed=42)
