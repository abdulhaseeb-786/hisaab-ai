from fastapi import APIRouter

from . import actions, copilot, credit, csv_import, dashboard, day, demo, forecast, insights, payables, products, reorder, store, workflow

api_router = APIRouter(prefix="/api")
for module in (store, actions, day, dashboard, products, reorder, forecast, insights, credit, payables, workflow, copilot, csv_import, demo):
    api_router.include_router(module.router)
