from fastapi import APIRouter
from .actions import router as actions_router
from .dashboard import router as dashboard_router
from .products import router as products_router
from .reorder import router as reorder_router
from .forecast import router as forecast_router
from .insights import router as insights_router
from .credit import router as credit_router
from .payables import router as payables_router
from .copilot import router as copilot_router
from .csv_import import router as csv_router
from .demo import router as demo_router

api_router = APIRouter(prefix="/api")

api_router.include_router(actions_router)
api_router.include_router(dashboard_router)
api_router.include_router(products_router)
api_router.include_router(reorder_router)
api_router.include_router(forecast_router)
api_router.include_router(insights_router)
api_router.include_router(credit_router)
api_router.include_router(payables_router)
api_router.include_router(copilot_router)
api_router.include_router(csv_router)
api_router.include_router(demo_router)
