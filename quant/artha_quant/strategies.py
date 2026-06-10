"""The base strategies (experts). Each emits a long-only target weight vector
over the universe, given prices known up to a point in time.

These are the inputs the meta-layer learns to weight. They are intentionally
DISTINCT in their behaviour so the meta-layer has genuine diversification to
work with (correlated experts weaken Hedge's guarantees):

  - RiskParityStrategy  : inverse-vol risk parity. The ANCHOR. No views, no
                          forecasts, never blows up. Hard to beat.
  - MomentumStrategy    : time-series momentum. Leans into trending assets.
  - MeanReversionStrategy: fades short-term moves toward the mean.
  - SentimentStrategy   : tilts by an external sentiment score (placeholder
                          wired to accept the headlines pipeline later).

Each strategy exposes:
    name: str
    target_weights(prices, as_of_idx) -> dict[symbol, weight]   (sums to 1)
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
import pandas as pd

from . import signals
from .universe import symbols


class Strategy(ABC):
    name: str

    @abstractmethod
    def target_weights(self, prices: pd.DataFrame, t: int) -> dict[str, float]:
        """Weights using ONLY prices.iloc[: t + 1] (point-in-time)."""
        raise NotImplementedError

    # Shared helper: trailing vols as of bar t.
    @staticmethod
    def _vols_at(prices: pd.DataFrame, t: int, window: int = 21) -> pd.Series:
        window_prices = prices.iloc[: t + 1]
        rets = signals.log_returns(window_prices)
        rv = signals.realized_vol(rets, window=window)
        return rv.iloc[-1]


class RiskParityStrategy(Strategy):
    """Inverse-volatility risk parity — the anchor/baseline.

    Equal *risk* (not capital) per asset. No expected-return input — the
    noisiest, most dangerous input — so it cannot be wrecked by a bad forecast.
    """

    name = "risk_parity"

    def target_weights(self, prices: pd.DataFrame, t: int) -> dict[str, float]:
        vols = self._vols_at(prices, t)
        raw = {s: 1.0 for s in prices.columns}  # equal conviction...
        scaled = signals.vol_scale(raw, vols)    # ...then inverse-vol scaled
        if not scaled:
            return {s: 1.0 / len(prices.columns) for s in prices.columns}
        return signals.normalize_long_only(scaled)


class MomentumStrategy(Strategy):
    """Time-series momentum: 12-1 month total return, then vol-scaled.

    Classic 252d lookback skipping the most recent 21d (the '12-1' convention,
    which avoids short-term reversal contamination). Only positive-momentum
    assets are held; if none, fall back to the anchor's risk parity.
    """

    name = "ts_momentum"

    def __init__(self, lookback: int = 252, skip: int = 21) -> None:
        self.lookback = lookback
        self.skip = skip

    def target_weights(self, prices: pd.DataFrame, t: int) -> dict[str, float]:
        need = self.lookback + self.skip + 1
        if t < need:
            return RiskParityStrategy().target_weights(prices, t)

        p_now = prices.iloc[t - self.skip]
        p_then = prices.iloc[t - self.skip - self.lookback]
        mom = (p_now / p_then) - 1.0

        raw = {s: float(mom[s]) for s in prices.columns if mom[s] > 0}
        if not raw:
            # No positive trend anywhere -> defensively fall back to anchor.
            return RiskParityStrategy().target_weights(prices, t)

        vols = self._vols_at(prices, t)
        scaled = signals.vol_scale(raw, vols)
        if not scaled:
            return RiskParityStrategy().target_weights(prices, t)
        return signals.normalize_long_only(scaled)


class MeanReversionStrategy(Strategy):
    """Short-horizon mean reversion: overweight assets that are cheap vs their
    own recent mean (negative z-score), vol-scaled.
    """

    name = "mean_reversion"

    def __init__(self, z_window: int = 21) -> None:
        self.z_window = z_window

    def target_weights(self, prices: pd.DataFrame, t: int) -> dict[str, float]:
        if t < self.z_window + 5:
            return RiskParityStrategy().target_weights(prices, t)

        window_prices = prices.iloc[: t + 1]
        # z-score of price vs trailing mean; we want to BUY low z (cheap).
        raw: dict[str, float] = {}
        for s in prices.columns:
            z = signals.zscore(window_prices[s], window=self.z_window).iloc[-1]
            if np.isnan(z):
                continue
            conviction = -z  # cheap (z<0) -> positive conviction
            if conviction > 0:
                raw[s] = float(conviction)

        if not raw:
            return RiskParityStrategy().target_weights(prices, t)

        vols = self._vols_at(prices, t)
        scaled = signals.vol_scale(raw, vols)
        if not scaled:
            return RiskParityStrategy().target_weights(prices, t)
        return signals.normalize_long_only(scaled)


class SentimentStrategy(Strategy):
    """Sentiment tilt — placeholder for the headlines NLP pipeline.

    Accepts an optional {symbol: sentiment_score in [-1, 1]} map. Until that is
    wired in, it returns a mild tilt toward equities/crypto (the risk sleeve),
    which by design is NOISY and should earn LOW reliability from the meta-layer
    — exactly the behaviour we want to demonstrate the reliability gate works.
    """

    name = "sentiment_tilt"

    def __init__(self, scores: dict[str, float] | None = None) -> None:
        self.scores = scores or {}

    def target_weights(self, prices: pd.DataFrame, t: int) -> dict[str, float]:
        raw: dict[str, float] = {}
        for s in prices.columns:
            score = self.scores.get(s, 0.0)
            # Map sentiment [-1,1] -> long-only conviction [0,1].
            conviction = max(0.0, 0.5 + 0.5 * score)
            raw[s] = conviction

        if sum(raw.values()) <= 1e-12:
            return RiskParityStrategy().target_weights(prices, t)

        vols = self._vols_at(prices, t)
        scaled = signals.vol_scale(raw, vols)
        if not scaled:
            return RiskParityStrategy().target_weights(prices, t)
        return signals.normalize_long_only(scaled)


def default_strategies() -> list[Strategy]:
    """The expert set fed to the meta-layer. Order is irrelevant."""
    return [
        RiskParityStrategy(),
        MomentumStrategy(),
        MeanReversionStrategy(),
        SentimentStrategy(),
    ]
