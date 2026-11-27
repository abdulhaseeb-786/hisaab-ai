"""HisaabAI API (CYE 2026, Track 3: FinTech & Financial Inclusion).

Run from the backend folder:  uvicorn app.main:app --port 8000 --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("hisaabai")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.DEMO_AUTO_REFRESH:
        from app.simulator.reset import demo_data_status, reset_and_seed_database

        status = demo_data_status()
        if status["needs_reset"]:
            logger.info("Refreshing demo data (%s)", status["reason"])
            reset_and_seed_database()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.include_router(api_router)


@app.get("/", tags=["Health"])
def root() -> dict:
    return {"project": settings.PROJECT_NAME, "version": settings.VERSION, "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health() -> dict:
    return {"status": "healthy"}
