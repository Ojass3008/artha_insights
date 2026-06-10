"""Ledger builder + full pipeline tests."""

import numpy as np
import pytest

from artha_quant.config import Config
from artha_quant.data import load_prices
from artha_quant.ledger import build_ledger, summarize
from artha_quant.pipeline import run_pipeline


@pytest.fixture(scope="module")
def prices():
    return load_prices(lookback_days=700, allow_network=False, seed=5)


def test_ledger_has_expected_shape(prices):
    bt = build_ledger(prices, warmup=200)
    # 4 strategies, one row each per realized bar.
    assert set(bt.ledger["strategy"].unique()) == {
        "risk_parity",
        "ts_momentum",
        "mean_reversion",
        "sentiment_tilt",
    }
    # Every row is tagged with a known regime.
    assert bt.ledger["regime"].notna().all()
    assert set(bt.ledger["regime"].unique()).issubset(
        {"risk_on", "neutral", "risk_off", "crisis"}
    )


def test_ledger_returns_are_finite(prices):
    bt = build_ledger(prices, warmup=200)
    assert np.isfinite(bt.ledger["ret"]).all()
    # Daily net returns should be sane (no absurd blowups from a bug).
    assert bt.ledger["ret"].abs().max() < 0.5


def test_transaction_costs_reduce_returns(prices):
    """Higher cost assumptions must produce a lower-equity risk-parity curve."""
    cheap = build_ledger(prices, cost_bps=1.0, warmup=200)
    pricey = build_ledger(prices, cost_bps=50.0, warmup=200)
    cheap_final = cheap.equity["risk_parity"].iloc[-1]
    pricey_final = pricey.equity["risk_parity"].iloc[-1]
    assert pricey_final < cheap_final


def test_summarize_produces_metrics(prices):
    bt = build_ledger(prices, warmup=200)
    stats = summarize(bt.equity)
    for col in ["ann_return", "ann_vol", "sharpe", "max_drawdown"]:
        assert col in stats.columns
    # Drawdowns are non-positive by definition.
    assert (stats["max_drawdown"] <= 1e-9).all()


def test_pipeline_anchor_only_is_safe():
    """The whole pipeline, offline, must still trade pure risk parity by default."""
    cfg = Config()  # ceiling 0
    run = run_pipeline(cfg, allow_network=False, lookback_days=600, seed=5)
    d = run.decision
    assert abs(d.weights_final["risk_parity"] - 1.0) < 1e-9
    assert abs(sum(d.weights_final.values()) - 1.0) < 1e-9


def test_pipeline_with_confidence_blends_off_anchor():
    cfg = Config(confidence_ceiling=0.5)
    run = run_pipeline(cfg, allow_network=False, lookback_days=600, seed=5)
    d = run.decision
    assert abs(sum(d.weights_final.values()) - 1.0) < 1e-9
    # With confidence on, the anchor no longer holds everything.
    assert d.weights_final["risk_parity"] < 0.999
