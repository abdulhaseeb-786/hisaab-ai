"""7-day demand forecast with an honest comparison against two baselines.

1. Build the daily sales series (store-local dates, zero-filled) up to yesterday.
2. Backtest: hold out the last 14 days, forecast them from the days before with each
   model, and score each with WAPE and MAE (chronological split, no future leakage).
3. Use the model with the lowest backtest WAPE for the forecast. If the baselines win,
   we say so. A sparse product (mostly zero-sale days) uses the moving average and is
   labelled as such.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.calendar_pk import day_context, upcoming_events
from app.core.clock import start_of_day, store_now
from app.forecasting.baselines import (
    forecast_calendar_smoothing, forecast_moving_average, forecast_naive_lag7, is_sparse_series,
    learn_factors,
)
from app.forecasting.metrics import compute_mae, compute_total_error, compute_wape
from app.models import Product, Sale, SaleLine

HISTORY_DAYS = 365
MODEL_WINDOW_DAYS = 120
HOLDOUT_DAYS = 14

MODEL_LABELS = {
    "calendar_smoothing": "Calendar-aware smoothing",
    "last_week_same_day": "Last week, same day",
    "moving_average_7d": "7-day average",
}


def daily_series(db: Session, store_id: int, end_day: date, days: int,
                 product_id: int | None = None, category: str | None = None) -> tuple[list[date], list[float]]:
    start_day = end_day - timedelta(days=days - 1)
    q = (
        db.query(func.date(Sale.timestamp).label("d"), func.sum(SaleLine.qty).label("units"))
        .join(Sale, Sale.sale_id == SaleLine.sale_id)
        .filter(Sale.store_id == store_id, Sale.status == "completed",
                Sale.timestamp >= start_of_day(start_day), Sale.timestamp < start_of_day(end_day + timedelta(days=1)))
    )
    if product_id:
        q = q.filter(SaleLine.product_id == product_id)
    elif category:
        q = q.join(Product, Product.product_id == SaleLine.product_id).filter(Product.category == category)
    by_day: dict[str, float] = defaultdict(float)
    for row in q.group_by("d"):
        by_day[str(row.d)] += float(row.units)
    dates = [start_day + timedelta(days=i) for i in range(days)]
    return dates, [by_day.get(d.isoformat(), 0.0) for d in dates]


def _run_models(history: list[float], dates: list[date], horizon: int,
                factor_history: list[float], factor_dates: list[date],
                weekday_override: list[float] | None = None) -> dict[str, list[float]]:
    return {
        "calendar_smoothing": forecast_calendar_smoothing(
            history, dates, horizon, factor_history=factor_history, factor_dates=factor_dates,
            weekday_override=weekday_override),
        "last_week_same_day": forecast_naive_lag7(history, horizon),
        "moving_average_7d": forecast_moving_average(history, 7, horizon),
    }


def _quality(total_error: float | None, sparse: bool) -> str:
    """Quality of the forecast for buying: how close the forecast total came to what sold."""
    if sparse:
        return "Sparse"
    if total_error is None:
        return "Unknown"
    if total_error <= 15:
        return "Good"
    if total_error <= 30:
        return "Fair"
    return "Low"


def generate_forecast(
    db: Session,
    store_id: int = 1,
    product_id: int | None = None,
    category: str | None = None,
    horizon_days: int = 7,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or store_now()
    end_day = now.date() - timedelta(days=1)  # today is not finished yet

    target_name = "Whole store"
    target_type = "store"
    pooled_category = None
    if product_id:
        p = db.get(Product, product_id)
        if not p or p.store_id != store_id:
            raise LookupError("Product not found")
        target_name, target_type, pooled_category = p.name, "product", p.category
    elif category:
        target_name, target_type = category, "category"

    year_dates, year_values = daily_series(db, store_id, end_day, HISTORY_DAYS, product_id, category)
    # Trim leading days before the records start (all zero because no data existed yet).
    first_nonzero = next((i for i, v in enumerate(year_values) if v > 0), len(year_values))
    year_dates, year_values = year_dates[first_nonzero:], year_values[first_nonzero:]

    dates, values = year_dates[-MODEL_WINDOW_DAYS:], year_values[-MODEL_WINDOW_DAYS:]
    sparse = is_sparse_series(values[-56:])

    # A single product borrows the weekday pattern of its whole category (pooling).
    def category_weekday(cut: int = 0) -> list[float] | None:
        if not pooled_category:
            return None
        cd, cv = daily_series(db, store_id, end_day - timedelta(days=cut), MODEL_WINDOW_DAYS, category=pooled_category)
        return learn_factors(cv, cd)[0]

    # Backtest on the last HOLDOUT_DAYS days.
    metrics: list[dict[str, Any]] = []
    if len(values) > HOLDOUT_DAYS + 28:
        train_v, train_d = values[:-HOLDOUT_DAYS], dates[:-HOLDOUT_DAYS]
        actual = values[-HOLDOUT_DAYS:]
        factor_v = year_values[: len(year_values) - HOLDOUT_DAYS]
        factor_d = year_dates[: len(year_dates) - HOLDOUT_DAYS]
        backtest = _run_models(train_v, train_d, HOLDOUT_DAYS, factor_v, factor_d, category_weekday(HOLDOUT_DAYS))
        for key, preds in backtest.items():
            metrics.append({
                "model": key,
                "label": MODEL_LABELS[key],
                "wape_pct": round(compute_wape(actual, preds), 1),
                "mae_units": round(compute_mae(actual, preds), 2),
                "total_error_pct": round(compute_total_error(actual, preds), 1),
            })

    if sparse:
        selected = "moving_average_7d"
        reason = "Most days have no sale, so a simple average is safer than a pattern model."
    elif metrics:
        best = min(metrics, key=lambda m: m["wape_pct"])
        selected = best["model"]
        reason = (
            f"{best['label']} had the lowest error ({best['wape_pct']}% WAPE) on the last "
            f"{HOLDOUT_DAYS} days, which the models had not seen."
        )
    else:
        selected = "moving_average_7d"
        reason = "Not enough history to compare models yet."

    pooled_weekday = category_weekday()
    forward = _run_models(values, dates, horizon_days, year_values, year_dates, pooled_weekday) if values else {
        k: [0.0] * horizon_days for k in MODEL_LABELS
    }
    selected_wape = next((m["wape_pct"] for m in metrics if m["model"] == selected), None)
    selected_total_error = next((m["total_error_pct"] for m in metrics if m["model"] == selected), None)

    weekday, events = learn_factors(year_values, year_dates) if year_values else ([1.0] * 7, {})
    if pooled_weekday:
        weekday = pooled_weekday
    predictions = []
    for h in range(horizon_days):
        d = now.date() + timedelta(days=h)
        ctx = day_context(d)
        predictions.append({
            "date": d,
            "forecast_units": forward[selected][h],
            "model_units": forward["calendar_smoothing"][h],
            "baseline_lag7_units": forward["last_week_same_day"][h],
            "baseline_ma7_units": forward["moving_average_7d"][h],
            "calendar_label": ctx.label,
        })

    history_out = [
        {"date": d, "units": v} for d, v in zip(dates[-28:], values[-28:])
    ]
    event_names = {"ramadan": "Ramadan", "pre_eid_fitr": "Chaand Raat week", "eid": "Eid days", "pre_eid_adha": "Week before Eid ul Adha"}
    learned_effects = [
        {"event": event_names[k], "multiplier": round(v, 2)} for k, v in sorted(events.items())
    ]

    return {
        "store_id": store_id,
        "target_type": target_type,
        "target_id": product_id,
        "target_name": target_name,
        "horizon_days": horizon_days,
        "model_used": selected,
        "model_label": MODEL_LABELS[selected],
        "selection_reason": reason,
        "quality_label": _quality(selected_total_error, sparse),
        "quality_reason": (
            "Most days have no sale." if sparse else
            "Not enough history yet." if selected_total_error is None else
            f"Over the last {HOLDOUT_DAYS} days the forecast total was {selected_total_error:.0f}% away from what actually sold."
        ),
        "evaluation_total_error_pct": selected_total_error,
        "is_sparse": sparse,
        "evaluation_wape_pct": selected_wape,
        "evaluation_mae": next((m["mae_units"] for m in metrics if m["model"] == selected), None),
        "holdout_days": HOLDOUT_DAYS,
        "model_comparison": metrics,
        "total_forecast_units": round(sum(p["forecast_units"] for p in predictions), 1),
        "daily_predictions": predictions,
        "history": history_out,
        "weekday_factors": [round(w, 2) for w in weekday],
        "learned_calendar_effects": learned_effects,
        "upcoming_events": upcoming_events(now.date(), 45),
    }
