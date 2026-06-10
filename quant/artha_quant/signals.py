"""Normalization + signal helpers shared by the strategies.

The single most important discipline here: allocate in units of RISK, not units
of currency. 1% in Bitcoin is not 1% in Treasuries. Every strategy that emits
asset weights runs them through `vol_scale` so a "position" means a risk
contribution, and `normalize_long_only` so weights are a valid long-only
portfolio on the simplex.

All windows are trailing; nothing here peeks at the future.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

TRADING_DAYS = 252


def log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Daily log returns. Comparable across assets; prices are not."""
    return np.log(prices / prices.shift(1))


def realized_vol(returns: pd.DataFrame, window: int = 21) -> pd.DataFrame:
    """Trailing annualized realized volatility per asset."""
    return returns.rolling(window, min_periods=max(5, window // 2)).std() * np.sqrt(
        TRADING_DAYS
    )


def vol_scale(raw_weights: dict[str, float], vols: pd.Series) -> dict[str, float]:
    """Scale raw directional weights into inverse-vol risk units.

    A higher-vol asset gets a smaller capital weight for the same conviction,
    so each name contributes comparable risk. Assets with missing/zero vol are
    dropped (we cannot size what we cannot measure).
    """
    scaled: dict[str, float] = {}
    for sym, w in raw_weights.items():
        v = vols.get(sym, np.nan)
        if v is None or np.isnan(v) or v <= 1e-9:
            continue
        scaled[sym] = w / v
    return scaled


def normalize_long_only(weights: dict[str, float]) -> dict[str, float]:
    """Clip negatives to 0 and project onto the simplex (sum to 1).

    This phase is long-only by construction — a robustness choice. Shorting
    multiplies estimation-error risk and is a later, deliberate extension.
    """
    clipped = {s: max(0.0, w) for s, w in weights.items()}
    total = sum(clipped.values())
    if total <= 1e-12:
        n = len(weights)
        return {s: 1.0 / n for s in weights} if n else {}
    return {s: w / total for s, w in clipped.items()}


def zscore(series: pd.Series, window: int = 63) -> pd.Series:
    """Trailing z-score of a series (for mean-reversion signals)."""
    mean = series.rolling(window, min_periods=window // 2).mean()
    std = series.rolling(window, min_periods=window // 2).std()
    return (series - mean) / std.replace(0.0, np.nan)
