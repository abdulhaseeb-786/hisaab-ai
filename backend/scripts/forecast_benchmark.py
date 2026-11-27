"""Forecast benchmark: our model against two baselines, on real and simulated data.

Protocol (the same for both datasets, no future data ever used):
* Rolling origin: 8 test windows of 14 days each, stepping back 14 days at a time from
  the end of the data. For each window, every model sees only the days before it.
* Metrics per window: WAPE (daily error) and total error (error on the 14-day total,
  which is what a reorder decision depends on). Results are summed over products and
  windows (sum of absolute errors / sum of units), so busy products weigh more.

Datasets:
1. Public: UCI Online Retail II, 30 busiest products (see build_public_benchmark.py).
2. Simulated: the demo store's 30 busiest products. Simulated accuracy is NOT evidence
   of real-world accuracy; it only checks that the model behaves sensibly.

Usage (from the backend folder):   python scripts/forecast_benchmark.py
Writes the results to docs/forecast_benchmark.md.
"""

from __future__ import annotations

import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.forecasting.baselines import (  # noqa: E402
    forecast_calendar_smoothing, forecast_moving_average, forecast_naive_lag7, learn_factors,
)

WINDOW = 14
ORIGINS = 8
MIN_TRAIN = 56
PUBLIC_CSV = BACKEND / "datasets" / "uci_online_retail_daily_top30.csv"
REPORT = BACKEND.parent / "docs" / "forecast_benchmark.md"

MODELS = {
    # Like the app: a single product borrows the weekday pattern pooled over many products.
    "Calendar-aware smoothing (ours)": lambda v, d, wk: forecast_calendar_smoothing(
        v[-120:], d[-120:], WINDOW, factor_history=v, factor_dates=d, weekday_override=wk),
    "Last week, same day": lambda v, d, wk: forecast_naive_lag7(v, WINDOW),
    "7-day average": lambda v, d, wk: forecast_moving_average(v, 7, WINDOW),
}


def evaluate(series: dict[str, tuple[list[date], list[float]]]) -> dict[str, dict[str, float]]:
    abs_err = defaultdict(float)
    total_err = defaultdict(float)
    units = 0.0
    windows = 0
    # Pooled series: all products summed, used only for the weekday pattern.
    first_dates = next(iter(series.values()))[0]
    pooled = np.sum([np.asarray(v, float) for _, v in series.values()], axis=0).tolist()
    pooled_weekday: dict[int, list[float]] = {}

    for dates, values in series.values():
        n = len(values)
        for k in range(ORIGINS):
            end = n - k * WINDOW
            start = end - WINDOW
            if start < MIN_TRAIN:
                break
            if start not in pooled_weekday:  # learned only from days before the window
                pooled_weekday[start] = learn_factors(pooled[max(0, start - 120):start], first_dates[max(0, start - 120):start])[0]
            actual = np.asarray(values[start:end], float)
            if actual.sum() == 0:
                continue
            units += actual.sum()
            windows += 1
            for name, fn in MODELS.items():
                pred = np.asarray(fn(values[:start], dates[:start], pooled_weekday[start]), float)
                abs_err[name] += float(np.abs(actual - pred).sum())
                total_err[name] += abs(float(actual.sum() - pred.sum()))
    return {
        name: {
            "wape": abs_err[name] / units * 100 if units else float("nan"),
            "total": total_err[name] / units * 100 if units else float("nan"),
            "windows": windows,
        }
        for name in MODELS
    }


def public_series() -> dict[str, tuple[list[date], list[float]]]:
    df = pd.read_csv(PUBLIC_CSV, parse_dates=["date"])
    out = {}
    for code, g in df.sort_values("date").groupby("stock_code"):
        out[str(code)] = ([d.date() for d in g["date"]], g["units"].astype(float).tolist())
    return out


def simulated_series() -> dict[str, tuple[list[date], list[float]]]:
    import os
    import tempfile

    os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp(), 'bench.db').as_posix()}"
    from app.core.clock import store_today
    from app.core.database import SessionLocal
    from app.forecasting.engine import daily_series
    from app.models import Product, SaleLine
    from app.simulator.reset import reset_and_seed_database
    from sqlalchemy import func

    reset_and_seed_database()
    db = SessionLocal()
    top = [pid for (pid,) in db.query(SaleLine.product_id).group_by(SaleLine.product_id)
           .order_by(func.sum(SaleLine.qty).desc()).limit(30)]
    end = store_today() - timedelta(days=1)
    out = {}
    for pid in top:
        dates, values = daily_series(db, 1, end, 365, product_id=pid)
        out[db.get(Product, pid).sku] = (dates, values)
    db.close()
    return out


def table(results: dict[str, dict[str, float]]) -> list[str]:
    best = min(results, key=lambda k: results[k]["wape"])
    lines = ["| Method | Daily error (WAPE) | 14-day total error |", "|---|---:|---:|"]
    for name, r in results.items():
        mark = " **(best)**" if name == best else ""
        lines.append(f"| {name}{mark} | {r['wape']:.1f}% | {r['total']:.1f}% |")
    return lines


def main() -> None:
    sections = [
        "# Forecast benchmark",
        "",
        "Generated by `backend/scripts/forecast_benchmark.py`. Rolling origin, "
        f"{ORIGINS} windows of {WINDOW} days per product; models only see data before each window.",
        "Lower is better. *Daily error* is WAPE. *14-day total error* is the error on the total units "
        "over each window, which is what a reorder decision depends on.",
        "",
    ]
    if PUBLIC_CSV.exists():
        pub = evaluate(public_series())
        sections += ["## Public data: UCI Online Retail II (real UK retailer, 30 busiest products)", "",
                     *table(pub), "", f"{next(iter(pub.values()))['windows']} product-windows evaluated.", ""]
    else:
        sections += ["## Public data", "", f"Not built yet: run `build_public_benchmark.py` to create `{PUBLIC_CSV.name}`.", ""]
    sim = evaluate(simulated_series())
    sections += ["## Simulated demo store (30 busiest products)", "", *table(sim), "",
                 f"{next(iter(sim.values()))['windows']} product-windows evaluated.", "",
                 "Simulated accuracy is not evidence of real-world accuracy. The simulator's demand follows "
                 "weekday and calendar patterns that the model is designed to find.", ""]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(sections), encoding="utf-8")
    print("\n".join(sections))


if __name__ == "__main__":
    main()
