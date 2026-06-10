"""Point-in-time regime engine.

Produces a regime PROBABILITY vector per day, not a hard label — hard labels
flip-flop and whipsaw allocation. Critically, every value is computed using
ONLY data available up to and including that day (rolling windows, no centring,
no future leakage). The label stored in the ledger is whatever this believed at
the time, never a hindsight-smoothed version.

This is a deliberately simple, transparent rule-based engine (trend + realized
vol + drawdown). The design notes call for HMM/GMM later; the interface here
(`regime_probabilities`) is what the meta-layer consumes, so a fancier engine
can be swapped in without touching anything downstream.

Regimes: risk_on, neutral, risk_off, crisis.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .universe import risk_assets

REGIMES = ("risk_on", "neutral", "risk_off", "crisis")


def _risk_basket(prices: pd.DataFrame) -> pd.Series:
    """Equal-weight price index of the risk assets (the regime is driven by
    how the risk-on sleeve is behaving)."""
    cols = [s for s in risk_assets() if s in prices.columns]
    if not cols:
        cols = list(prices.columns)
    norm = prices[cols] / prices[cols].iloc[0]
    return norm.mean(axis=1)


def regime_features(prices: pd.DataFrame) -> pd.DataFrame:
    """Rolling, point-in-time features that drive the regime classification."""
    basket = _risk_basket(prices)
    logret = np.log(basket / basket.shift(1))

    # Trend: price vs its own 50d / 200d moving averages (all trailing).
    ma_fast = basket.rolling(50, min_periods=20).mean()
    ma_slow = basket.rolling(200, min_periods=60).mean()
    trend = (ma_fast - ma_slow) / ma_slow

    # Realized vol, annualized, trailing 21d; and its long-run percentile.
    rv = logret.rolling(21, min_periods=10).std() * np.sqrt(252)
    rv_rank = rv.rolling(252, min_periods=60).rank(pct=True)

    # Drawdown from a trailing running peak (expanding, so point-in-time).
    running_peak = basket.cummax()
    drawdown = basket / running_peak - 1.0

    return pd.DataFrame(
        {
            "trend": trend,
            "rv": rv,
            "rv_rank": rv_rank,
            "drawdown": drawdown,
        }
    )


def regime_probabilities(prices: pd.DataFrame) -> pd.DataFrame:
    """Per-day soft regime probabilities over REGIMES.

    Scoring logic (each regime gets an unnormalized score, then softmax):
      - risk_on : positive trend, calm vol, shallow drawdown
      - neutral : flat trend, middling vol
      - risk_off: negative trend OR elevated vol
      - crisis  : deep drawdown AND high vol (the tail state)
    Softmax turns scores into probabilities so boundaries are smooth.
    """
    feat = regime_features(prices)
    out = pd.DataFrame(index=prices.index, columns=REGIMES, dtype="float64")

    for dt, row in feat.iterrows():
        trend = _nz(row["trend"])
        rv_rank = _nz(row["rv_rank"], 0.5)
        dd = _nz(row["drawdown"])

        # Scores in a comparable scale. Coefficients chosen for sensible
        # behaviour, not fit to data (avoid overfitting the regime model).
        s_risk_on = 8.0 * trend - 1.5 * rv_rank - 4.0 * abs(min(dd, 0.0))
        s_neutral = 1.0 - 6.0 * abs(trend) - 1.0 * abs(rv_rank - 0.5)
        s_risk_off = -6.0 * trend + 2.0 * rv_rank + 3.0 * abs(min(dd, 0.0))
        s_crisis = (
            2.5 * rv_rank
            + 10.0 * abs(min(dd + 0.10, 0.0))  # only past -10% drawdown
            - 1.0
        )

        scores = np.array([s_risk_on, s_neutral, s_risk_off, s_crisis])
        probs = _softmax(scores)
        out.loc[dt] = probs

    return out.fillna(0.25)  # before features warm up: maximally uncertain


def hard_label(prob_row: pd.Series) -> str:
    """The point-in-time max-probability regime (what we store in the ledger)."""
    return str(prob_row.astype(float).idxmax())


def _softmax(x: np.ndarray) -> np.ndarray:
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()


def _nz(v, default: float = 0.0) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return default if np.isnan(f) else f
