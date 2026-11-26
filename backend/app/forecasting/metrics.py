"""Retail Demand Forecasting Error Metrics.
Implements MAE and WAPE.
Note: WAPE is used instead of MAPE because retail demand has frequent 0-sale days
where MAPE divides by zero and produces infinity.
"""

from typing import List, Sequence
import numpy as np

def compute_mae(actuals: Sequence[float], predictions: Sequence[float]) -> float:
    """Mean Absolute Error."""
    if not actuals or len(actuals) != len(predictions):
        return 0.0
    arr_a = np.array(actuals, dtype=float)
    arr_p = np.array(predictions, dtype=float)
    return float(np.mean(np.abs(arr_a - arr_p)))

def compute_wape(actuals: Sequence[float], predictions: Sequence[float]) -> float:
    """Weighted Absolute Percentage Error (WAPE) expressed as a percentage.
    Formula: (Sum(|Actual - Forecast|) / Sum(Actual)) * 100
    """
    if not actuals or len(actuals) != len(predictions):
        return 0.0
    arr_a = np.array(actuals, dtype=float)
    arr_p = np.array(predictions, dtype=float)
    total_actual = float(np.sum(arr_a))
    if total_actual == 0.0:
        return 0.0
    total_abs_error = float(np.sum(np.abs(arr_a - arr_p)))
    return (total_abs_error / total_actual) * 100.0
