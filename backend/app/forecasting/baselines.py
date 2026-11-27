"""Forecasting models (FC-01..03).

Baselines:
* Last-week-same-day (seasonal naive): tomorrow = the same weekday last week.
* 7-day moving average: tomorrow = mean of the last 7 days.

Model: calendar-aware exponential smoothing.
* Day-of-week factors are estimated from the history itself (mean of each weekday /
  overall mean), shrunk towards 1.0 when there is little data.
* Ramadan, Eid and other calendar effects come from `calendar_pk`. The size of each
  effect is learned from the product's own history (e.g. how much more it sold last
  Ramadan); a day type the history never saw gets factor 1.0.
* The level is exponentially smoothed on the history after removing those factors,
  then multiplied back by the factors of each future day.

All functions take a list of daily quantities in date order and the matching dates.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

import numpy as np

from app.core.calendar_pk import day_context

ALPHA = 0.3
SHRINK_DAYS = 28  # how much data before we fully trust a weekday factor


def forecast_naive_lag7(history: Sequence[float], horizon: int = 7) -> list[float]:
    if not history:
        return [0.0] * horizon
    if len(history) < 7:
        return [round(float(np.mean(history)), 2)] * horizon
    last_week = list(history[-7:])
    return [round(float(last_week[h % 7]), 2) for h in range(horizon)]


def forecast_moving_average(history: Sequence[float], window: int = 7, horizon: int = 7) -> list[float]:
    if not history:
        return [0.0] * horizon
    window_values = history[-window:] if len(history) >= window else history
    return [round(float(np.mean(window_values)), 2)] * horizon


def _event_key(d: date) -> str | None:
    ctx = day_context(d)
    if ctx.is_eid_ul_fitr or ctx.is_eid_ul_adha:
        return "eid"
    if ctx.is_pre_eid_fitr:
        return "pre_eid_fitr"
    if ctx.is_ramadan:
        return "ramadan"
    if ctx.is_pre_eid_adha:
        return "pre_eid_adha"
    return None


def learn_factors(history: Sequence[float], dates: Sequence[date]) -> tuple[list[float], dict[str, float]]:
    """Weekday factors and calendar-event factors learned from the history."""
    values = np.asarray(history, dtype=float)
    keys = [_event_key(d) for d in dates]
    normal_mask = np.array([k is None for k in keys])
    base = values[normal_mask].mean() if normal_mask.any() and values[normal_mask].mean() > 0 else (values.mean() or 1.0)

    weekday = []
    for wd in range(7):
        mask = normal_mask & np.array([d.weekday() == wd for d in dates])
        n = int(mask.sum())
        raw = values[mask].mean() / base if n and base > 0 else 1.0
        weight = min(1.0, n * 7 / SHRINK_DAYS)
        weekday.append(float(1.0 + (raw - 1.0) * weight))

    events: dict[str, float] = {}
    for key in {k for k in keys if k}:
        mask = np.array([k == key for k in keys])
        if mask.sum() >= 2 and base > 0:
            events[key] = float(max(0.2, min(6.0, values[mask].mean() / base)))
    return weekday, events


def _factor(d: date, weekday: list[float], events: dict[str, float]) -> float:
    key = _event_key(d)
    return weekday[d.weekday()] * (events.get(key, 1.0) if key else 1.0)


def forecast_calendar_smoothing(
    history: Sequence[float],
    dates: Sequence[date],
    horizon: int = 7,
    factor_history: Sequence[float] | None = None,
    factor_dates: Sequence[date] | None = None,
    alpha: float | None = None,
    weekday_override: list[float] | None = None,
) -> list[float]:
    """Calendar-aware exponential smoothing.

    `factor_history`/`factor_dates` can be a longer history (e.g. the past year) used only
    to learn the weekday and Ramadan/Eid effects; it must end where `history` ends.
    `weekday_override` lets a slow product borrow the weekday pattern of its category,
    which is far less noisy than its own.
    """
    if not history:
        return [0.0] * horizon
    weekday, events = learn_factors(factor_history or history, factor_dates or dates)
    if weekday_override:
        weekday = weekday_override
    if alpha is None:
        # Slow sellers are noisy: smooth more so one busy day does not swing the forecast.
        alpha = ALPHA if float(np.mean(history[-28:])) >= 5 else 0.12
    level = None
    for value, d in zip(history, dates):
        f = _factor(d, weekday, events) or 1.0
        deseasonalised = value / f
        level = deseasonalised if level is None else alpha * deseasonalised + (1 - alpha) * level
    start = dates[-1]
    return [round(max(0.0, (level or 0.0) * _factor(start + timedelta(days=h + 1), weekday, events)), 2) for h in range(horizon)]


def is_sparse_series(history: Sequence[float], zero_threshold: float = 0.6) -> bool:
    """Intermittent demand: most days have zero sales."""
    if not history or len(history) < 14:
        return True
    arr = np.asarray(history, dtype=float)
    return float((arr == 0).mean()) >= zero_threshold
