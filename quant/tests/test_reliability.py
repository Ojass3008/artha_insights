"""Reliability scoring tests — the defenses against performance-chasing."""

import numpy as np

from artha_quant.config import Config
from artha_quant.reliability import (
    CellStats,
    compute_cell_stats,
    lcb_sharpe,
    reliability_scores,
    sharpe_standard_error,
    shrink_toward_mean,
)


def test_lcb_punishes_thin_samples():
    # Same point Sharpe, very different sample sizes. The thin one must have a
    # much lower (more pessimistic) LCB.
    z = 1.0
    lcb_thin = lcb_sharpe(2.0, eff_n=10, z=z)
    lcb_thick = lcb_sharpe(2.0, eff_n=500, z=z)
    assert lcb_thin < lcb_thick
    # The thick-sample LCB should remain clearly positive; the thin one is cut hard.
    assert lcb_thick > 1.0
    assert lcb_thin < lcb_thick - 0.3


def test_standard_error_grows_as_n_shrinks():
    se_small = sharpe_standard_error(1.0, eff_n=10)
    se_large = sharpe_standard_error(1.0, eff_n=1000)
    assert se_small > se_large


def test_shrinkage_pulls_low_n_toward_prior():
    values = np.array([3.0, 3.0])
    eff_ns = np.array([5.0, 500.0])  # first is thin, second is well-sampled
    prior = 0.0
    out = shrink_toward_mean(values, eff_ns, prior, shrink_k=60.0)
    # The thin estimate is pulled much closer to the prior than the thick one.
    assert out[0] < out[1]
    assert abs(out[0] - prior) < abs(values[0] - prior)


def test_thin_cell_reliability_is_gated_to_low():
    cfg = Config()
    rng = np.random.default_rng(0)
    # A "lucky" strategy: high mean but only a handful of observations.
    lucky = compute_cell_stats(
        "lucky", "risk_on", rng.normal(0.01, 0.002, size=8), cfg
    )
    # A "real" strategy: modest mean, lots of observations.
    real = compute_cell_stats(
        "real", "risk_on", rng.normal(0.0008, 0.01, size=400), cfg
    )
    scores = reliability_scores([lucky, real], cfg)
    # The lucky/thin strategy must NOT out-trust the well-sampled one.
    assert scores["lucky"] < scores["real"]
    # And the thin cell is gated below the min_effective_n threshold.
    assert scores["lucky"] < 0.5


def test_reliability_in_unit_interval():
    cfg = Config()
    rng = np.random.default_rng(1)
    cells = [
        compute_cell_stats(s, "neutral", rng.normal(0.0005, 0.01, 200), cfg)
        for s in ["a", "b", "c"]
    ]
    scores = reliability_scores(cells, cfg)
    for v in scores.values():
        assert 0.0 <= v <= 1.0


def test_empty_returns_are_safe():
    cfg = Config()
    cs = compute_cell_stats("x", "neutral", np.zeros(0), cfg)
    assert cs.eff_n == 0.0
    assert cs.sharpe == 0.0
