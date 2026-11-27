"""Forecasting: baselines, calendar features, honest model selection (FC-01..03)."""

from datetime import date, timedelta

from app.core.calendar_pk import day_context
from app.forecasting.baselines import (
    forecast_calendar_smoothing, forecast_moving_average, forecast_naive_lag7, is_sparse_series, learn_factors,
)
from app.forecasting.engine import generate_forecast
from app.forecasting.metrics import compute_mae, compute_wape


def test_metrics():
    assert compute_wape([10, 10], [8, 12]) == 20.0
    assert compute_mae([10, 10], [8, 12]) == 2.0
    assert compute_wape([0, 0], [0, 0]) == 0.0
    assert compute_wape([0, 0], [1, 0]) == 100.0


def test_baselines():
    hist = [1, 2, 3, 4, 5, 6, 7, 8]
    assert forecast_naive_lag7(hist, 7) == [2, 3, 4, 5, 6, 7, 8]
    assert forecast_moving_average(hist, 7, 3) == [5.0, 5.0, 5.0]
    assert is_sparse_series([0] * 20 + [1])
    assert not is_sparse_series([3] * 30)


def test_calendar_knows_ramadan_and_eid_2026():
    assert day_context(date(2026, 3, 1)).is_ramadan
    assert day_context(date(2026, 3, 21)).is_eid_ul_fitr
    assert day_context(date(2026, 5, 27)).is_eid_ul_adha
    assert not day_context(date(2026, 11, 27)).is_ramadan


def test_model_learns_a_weekly_pattern():
    start = date(2026, 1, 5)  # a Monday, outside Ramadan
    dates = [start + timedelta(days=i) for i in range(35)]
    values = [20.0 if d.weekday() == 4 else 10.0 for d in dates]  # Fridays double
    weekday, _ = learn_factors(values, dates)
    assert weekday[4] > 1.5 and weekday[0] < 1.0
    preds = forecast_calendar_smoothing(values, dates, 7)
    friday = [p for i, p in enumerate(preds) if (dates[-1] + timedelta(days=i + 1)).weekday() == 4][0]
    assert friday > 1.6 * min(preds)


def test_selected_model_is_the_backtest_winner(db_session):
    fc = generate_forecast(db_session, category="Dairy & Breakfast")
    best = min(fc["model_comparison"], key=lambda m: m["wape_pct"])
    assert fc["model_used"] == best["model"]
    assert fc["evaluation_wape_pct"] == best["wape_pct"]
    assert len(fc["daily_predictions"]) == 7
    assert fc["daily_predictions"][0]["date"] > fc["history"][-1]["date"]  # no overlap with history


def test_store_level_model_beats_both_baselines_on_synthetic_data(db_session):
    """Synthetic data only; never presented as real-world accuracy."""
    fc = generate_forecast(db_session)
    scores = {m["model"]: m["wape_pct"] for m in fc["model_comparison"]}
    assert scores["calendar_smoothing"] < scores["last_week_same_day"]
    assert scores["calendar_smoothing"] < scores["moving_average_7d"]


def test_dead_item_is_sparse(db_session):
    from app.models import Product
    sparkle = db_session.query(Product).filter(Product.sku == "CLN-012").one()
    fc = generate_forecast(db_session, product_id=sparkle.product_id)
    assert fc["is_sparse"] and fc["quality_label"] == "Sparse"
    assert fc["total_forecast_units"] == 0
