"""7-Day Demand Forecasting API Engine.
Chronological data extraction from SQL, baseline evaluation,
sparse detection fallback, and typed response generation.
"""

from datetime import datetime, timedelta, timezone, date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Product, SaleLine, Sale
from app.forecasting.baselines import (
    forecast_naive_lag7,
    forecast_moving_average,
    forecast_exponential_smoothing_calendar,
    is_sparse_series
)
from app.forecasting.metrics import compute_mae, compute_wape

def generate_forecast(
    db: Session,
    store_id: int = 1,
    product_id: Optional[int] = None,
    category: Optional[str] = None,
    horizon_days: int = 7
) -> Dict[str, Any]:
    """Generate 7-day forecast with baseline comparison, MAE, and WAPE evaluation."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sixty_days_ago = now - timedelta(days=60)

    # 1. Build Query for Daily Sales Timeseries
    query = (
        db.query(
            func.date(Sale.timestamp).label("sale_date"),
            func.coalesce(func.sum(SaleLine.qty), 0.0).label("daily_qty")
        )
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.timestamp >= sixty_days_ago)
    )

    target_name = "Overall Store Sales"
    if product_id:
        p = db.query(Product).filter(Product.product_id == product_id).first()
        target_name = p.name if p else f"Product #{product_id}"
        query = query.filter(SaleLine.product_id == product_id)
    elif category:
        target_name = f"Category: {category}"
        query = query.join(Product, Product.product_id == SaleLine.product_id).filter(Product.category == category)

    daily_rows = query.group_by(func.date(Sale.timestamp)).order_by(func.date(Sale.timestamp).asc()).all()

    # Reconstruct daily timeseries map for continuous 60 days
    date_map = {row.sale_date: float(row.daily_qty) for row in daily_rows}
    all_dates = [(sixty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(60)]
    history = [date_map.get(d, 0.0) for d in all_dates]

    # Chronological Holdout Split for Evaluation (last 14 days of history)
    train_history = history[:-14]
    test_actuals = history[-14:]

    # Backtest evaluation on holdout test set
    backtest_preds = forecast_exponential_smoothing_calendar(train_history, horizon=14)
    backtest_mae = compute_mae(test_actuals, backtest_preds)
    backtest_wape = compute_wape(test_actuals, backtest_preds)

    sparse = is_sparse_series(history)
    if sparse:
        model_name = "Baseline-Moving-Average-Fallback"
        quality_label = "Sparse-Fallback (Intermittent Demand)"
        preds = forecast_moving_average(history, window=7, horizon=horizon_days)
    else:
        model_name = "Exponential-Smoothing-Calendar"
        quality_label = "High" if backtest_wape < 35.0 else "Moderate"
        preds = forecast_exponential_smoothing_calendar(history, horizon=horizon_days)

    lag7_preds = forecast_naive_lag7(history, horizon=horizon_days)
    ma7_preds = forecast_moving_average(history, window=7, horizon=horizon_days)

    daily_predictions = []
    base_date = now.date()
    for h in range(horizon_days):
        forecast_dt = base_date + timedelta(days=h + 1)
        daily_predictions.append({
            "date": forecast_dt,
            "forecast_units": preds[h],
            "baseline_lag7_units": lag7_preds[h],
            "baseline_ma7_units": ma7_preds[h]
        })

    return {
        "store_id": store_id,
        "target_type": "product" if product_id else ("category" if category else "store"),
        "target_id": product_id,
        "target_name": target_name,
        "horizon_days": horizon_days,
        "model_used": model_name,
        "quality_label": quality_label,
        "evaluation_wape_pct": round(backtest_wape, 2),
        "evaluation_mae": round(backtest_mae, 2),
        "daily_predictions": daily_predictions,
        "data_label": "Demo Data"
    }
