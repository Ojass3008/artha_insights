"""Strategy + signal tests: weights are valid, long-only, and point-in-time."""

import numpy as np
import pandas as pd
import pytest

from artha_quant import signals
from artha_quant.data import load_prices
from artha_quant.strategies import (
    MeanReversionStrategy,
    MomentumStrategy,
    RiskParityStrategy,
    SentimentStrategy,
    default_strategies,
)


@pytest.fixture(scope="module")
def prices():
    # Offline deterministic prices — no network in tests.
    return load_prices(lookback_days=600, allow_network=False, seed=3)


def test_prices_are_clean(prices):
    assert not prices.isnull().any().any()
    assert prices.shape[1] == 4
    assert (prices > 0).all().all()


def test_normalize_long_only_sums_to_one():
    w = signals.normalize_long_only({"a": 2.0, "b": -1.0, "c": 3.0})
    assert abs(sum(w.values()) - 1.0) < 1e-9
    assert w["b"] == 0.0  # negative clipped


def test_vol_scale_downweights_high_vol():
    vols = pd.Series({"calm": 0.05, "wild": 0.50})
    scaled = signals.vol_scale({"calm": 1.0, "wild": 1.0}, vols)
    # Equal conviction -> the calm asset gets far more capital weight.
    assert scaled["calm"] > scaled["wild"]


@pytest.mark.parametrize(
    "strat",
    [
        RiskParityStrategy(),
        MomentumStrategy(),
        MeanReversionStrategy(),
        SentimentStrategy(),
    ],
)
def test_weights_valid_simplex(strat, prices):
    t = len(prices) - 1
    w = strat.target_weights(prices, t)
    assert abs(sum(w.values()) - 1.0) < 1e-6
    assert all(v >= -1e-9 for v in w.values())


def test_risk_parity_equalizes_risk(prices):
    """Inverse-vol weights should give the higher-vol asset a smaller weight."""
    t = len(prices) - 1
    w = RiskParityStrategy().target_weights(prices, t)
    rets = signals.log_returns(prices.iloc[: t + 1])
    vols = signals.realized_vol(rets).iloc[-1]
    # BTC is the highest-vol asset; it must not be the largest weight.
    btc_w = w.get("BTC-USD", 0.0)
    assert btc_w == min(w.values()) or btc_w <= np.median(list(w.values()))


def test_strategies_are_point_in_time(prices):
    """A strategy's weights at bar t must not change if FUTURE bars are altered.

    We compute weights on the full series and on a future-corrupted copy that
    is identical up to t; the decision at t must be unaffected.
    """
    t = 400
    strat = MomentumStrategy()
    w_clean = strat.target_weights(prices, t)

    corrupted = prices.copy()
    corrupted.iloc[t + 1 :] *= 1.5  # tamper with the future only
    w_corrupt = strat.target_weights(corrupted, t)

    for k in w_clean:
        assert abs(w_clean[k] - w_corrupt.get(k, 0.0)) < 1e-9


def test_default_strategy_set():
    names = {s.name for s in default_strategies()}
    assert names == {"risk_parity", "ts_momentum", "mean_reversion", "sentiment_tilt"}
