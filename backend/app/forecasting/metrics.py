"""Forecast error metrics.

WAPE is used instead of MAPE because retail demand has many zero-sale days, where MAPE
divides by zero.
"""

from __future__ import annotations

from typing import Sequence

import numpy as np


def compute_mae(actuals: Sequence[float], predictions: Sequence[float]) -> float:
    """Mean absolute error, in units."""
    if len(actuals) == 0 or len(actuals) != len(predictions):
        return 0.0
    return float(np.mean(np.abs(np.asarray(actuals, float) - np.asarray(predictions, float))))


def compute_total_error(actuals: Sequence[float], predictions: Sequence[float]) -> float:
    """Error on the total over the whole window, in percent: |sum(actual) - sum(forecast)| / sum(actual).

    Reordering depends on how much will sell over the coming days, not on any single
    day, so this is the error that matters for the buying decision.
    """
    if len(actuals) == 0 or len(actuals) != len(predictions):
        return 0.0
    total = float(np.sum(actuals))
    diff = abs(total - float(np.sum(predictions)))
    if total == 0:
        return 0.0 if diff == 0 else 100.0
    return diff / total * 100.0


def compute_wape(actuals: Sequence[float], predictions: Sequence[float]) -> float:
    """Weighted absolute percentage error: sum(|actual - forecast|) / sum(actual) x 100.

    When nothing was sold in the window, any forecast above zero is 100% wrong and a zero
    forecast is perfect.
    """
    if len(actuals) == 0 or len(actuals) != len(predictions):
        return 0.0
    a = np.asarray(actuals, float)
    p = np.asarray(predictions, float)
    total = float(a.sum())
    error = float(np.abs(a - p).sum())
    if total == 0:
        return 0.0 if error == 0 else 100.0
    return error / total * 100.0
