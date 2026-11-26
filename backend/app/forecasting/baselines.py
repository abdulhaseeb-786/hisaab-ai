"""Retail Demand Forecasting Models and Baselines.
Requirements FC-01, FC-02, FC-03:
- Baseline 1: Naive Lag-7 (Last-week-same-day: y_{t-7})
- Baseline 2: 7-Day Simple Moving Average
- Model: Exponential Smoothing with Day-of-Week and Ramadan/Eid Calendar Multipliers
- Sparse demand fallback logic
"""

from typing import List, Sequence
import numpy as np

def forecast_naive_lag7(history: Sequence[float], horizon: int = 7) -> List[float]:
    """Baseline 1: predicts sales equal to the same day from 7 days ago."""
    if len(history) < 7:
        mean_val = float(np.mean(history)) if len(history) > 0 else 0.0
        return [round(mean_val, 2)] * horizon
    
    # Use the last 7 recorded daily values as the next 7 days
    last_7 = list(history[-7:])
    forecast = []
    for h in range(horizon):
        forecast.append(round(float(last_7[h % 7]), 2))
    return forecast

def forecast_moving_average(history: Sequence[float], window: int = 7, horizon: int = 7) -> List[float]:
    """Baseline 2: rolling mean of the last window days."""
    if not history:
        return [0.0] * horizon
    slice_window = history[-window:] if len(history) >= window else history
    ma_val = float(np.mean(slice_window))
    return [round(ma_val, 2)] * horizon

def forecast_exponential_smoothing_calendar(
    history: Sequence[float],
    alpha: float = 0.35,
    horizon: int = 7,
    dow_multipliers: Sequence[float] = None,
    is_ramadan_window: bool = False
) -> List[float]:
    """Exponential Smoothing with calendar seasonality."""
    if not history:
        return [0.0] * horizon

    if len(history) < 5:
        return forecast_moving_average(history, window=3, horizon=horizon)

    # Compute smoothed level
    s = history[0]
    for val in history[1:]:
        s = alpha * val + (1.0 - alpha) * s

    predictions = []
    default_dows = [1.0, 1.0, 1.0, 1.0, 1.25, 1.05, 1.20]  # Mon to Sun (spikes on Fri/Sun)
    dows = dow_multipliers or default_dows

    for h in range(horizon):
        dow_factor = dows[h % 7]
        ramadan_factor = 1.35 if is_ramadan_window else 1.0
        pred = max(0.0, s * dow_factor * ramadan_factor)
        predictions.append(round(pred, 2))

    return predictions

def is_sparse_series(history: Sequence[float], zero_threshold: float = 0.65) -> bool:
    """Check if time series is sparse / intermittent (more than 65% zeros)."""
    if not history or len(history) < 7:
        return True
    arr = np.array(history)
    zero_ratio = float(np.sum(arr == 0.0)) / float(len(arr))
    return zero_ratio >= zero_threshold
