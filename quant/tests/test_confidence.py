"""Confidence + anchor-blend tests."""

from artha_quant.config import Config
from artha_quant.confidence import (
    compute_confidence,
    normalized_entropy,
    weight_dispersion,
)


def test_entropy_extremes():
    assert normalized_entropy({"a": 1.0, "b": 0.0, "c": 0.0}) == 0.0
    # Uniform over 3 -> max entropy -> ~1.0
    u = normalized_entropy({"a": 1 / 3, "b": 1 / 3, "c": 1 / 3})
    assert abs(u - 1.0) < 1e-9


def test_dispersion_identical_vectors_is_zero():
    v = {"eq": 0.5, "bond": 0.5}
    assert weight_dispersion([v, dict(v)]) == 0.0


def test_dispersion_opposite_vectors_is_high():
    a = {"eq": 1.0, "bond": 0.0}
    b = {"eq": 0.0, "bond": 1.0}
    assert weight_dispersion([a, b]) > 0.9


def test_confidence_ceiling_forces_anchor_only():
    cfg = Config()  # ceiling = 0.0
    res = compute_confidence(
        regime_probs={"risk_on": 0.9, "neutral": 0.1},
        expert_weight_vectors=[{"eq": 1.0}, {"eq": 1.0}],
        reliabilities={"mom": 0.9, "mr": 0.8},
        active_regime="risk_on",
        cfg=cfg,
    )
    # Even with high raw confidence, the effective confidence is capped to 0.
    assert res.c_raw > 0.0
    assert res.c_effective == 0.0
    assert res.anchor_blend == 1.0


def test_raising_ceiling_lets_confidence_through():
    cfg = Config(confidence_ceiling=0.5)
    res = compute_confidence(
        regime_probs={"risk_on": 1.0},
        expert_weight_vectors=[{"eq": 1.0}, {"eq": 1.0}],
        reliabilities={"mom": 0.9, "mr": 0.9},
        active_regime="risk_on",
        cfg=cfg,
    )
    # High raw confidence, but capped at the 0.5 ceiling.
    assert res.c_effective == 0.5


def test_rare_regime_derates_confidence():
    cfg = Config(confidence_ceiling=1.0)
    base = compute_confidence(
        regime_probs={"risk_on": 1.0},
        expert_weight_vectors=[{"eq": 1.0}, {"eq": 1.0}],
        reliabilities={"mom": 0.9},
        active_regime="risk_on",
        cfg=cfg,
    )
    crisis = compute_confidence(
        regime_probs={"crisis": 1.0},
        expert_weight_vectors=[{"eq": 1.0}, {"eq": 1.0}],
        reliabilities={"mom": 0.9},
        active_regime="crisis",
        cfg=cfg,
    )
    # Same inputs but the rare 'crisis' regime is de-rated (halved).
    assert crisis.c_raw < base.c_raw
