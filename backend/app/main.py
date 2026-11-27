"""HisaabAI FastAPI Application Entrypoint.
Hackathon Edition (CYE 2026 - Track 3: FinTech & Financial Inclusion)
Modular Monolith Backend with OpenAPI/Swagger Documentation.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.api.router import api_router

BASE_DIR = Path(__file__).resolve().parent.parent
static_dir = BASE_DIR / "static"
static_dir.mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database schema exists
    init_db()
    yield
    # Shutdown logic if needed

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Mount local static assets for product pack shots and icons
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Enable CORS for local React/Vite development and mobile devices
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all /api routers
app.include_router(api_router)

@app.get("/", tags=["Health"])
def root_endpoint():
    return {
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "store": settings.STORE_NAME,
        "currency": settings.STORE_CURRENCY,
        "data_label": settings.DEMO_DATA_LABEL,
        "docs": "/docs",
        "cye_track": "Track 3 - FinTech & Financial Inclusion"
    }

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
