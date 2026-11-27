from fastapi import APIRouter

from . import actions, copilot, credit, csv_import, dashboard, demo, forecast, insights, payables, products, reorder, store

api_router = APIRouter(prefix="/api")
for module in (store, actions, dashboard, products, reorder, forecast, insights, credit, payables, copilot, csv_import, demo):
    api_router.include_router(module.router)
