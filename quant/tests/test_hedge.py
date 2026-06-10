"""Hedge meta-update + weight-cap tests."""

import numpy as np

from artha_quant.hedge import apply_weight_cap, hedge_update


def test_update_normalizes_to_one():
    w = {"a": 0.25, "b": 0.25, "c": 0.25, "d": 0.25}
    scores = {"a": 1.0, "b": -1.0, "c": 0.0, "d": 0.5}
    rho = {"a": 1.0, "b": 1.0, "c": 1.0, "d": 1.0}
    out = hedge_update(w, scores, rho, learning_rate=0.2)
    assert abs(sum(out.values()) - 1.0) < 1e-9


def test_winner_gains_weight_loser_loses():
    w = {"a": 0.5, "b": 0.5}
    scores = {"a": 1.0, "b": -1.0}
    rho = {"a": 1.0, "b": 1.0}
    out = hedge_update(w, scores, rho, learning_rate=0.5)
    assert out["a"] > 0.5 > out["b"]


def test_reliability_gates_learning():
    # Two strategies with identical positive scores, but one is fully reliable
    # and the other is not. The reliable one should gain MORE weight.
    w = {"trusted": 0.5, "untrusted": 0.5}
    scores = {"trusted": 1.0, "untrusted": 1.0}
    rho = {"trusted": 1.0, "untrusted": 0.05}
    out = hedge_update(w, scores, rho, learning_rate=0.5)
    assert out["trusted"] > out["untrusted"]


def test_zero_learning_rate_is_identity():
    w = {"a": 0.3, "b": 0.7}
    scores = {"a": 1.0, "b": -1.0}
    rho = {"a": 1.0, "b": 1.0}
    out = hedge_update(w, scores, rho, learning_rate=0.0)
    assert abs(out["a"] - 0.3) < 1e-9
    assert abs(out["b"] - 0.7) < 1e-9


def test_weight_cap_enforced_with_exempt_anchor():
    # 'mom' wants 0.7 but is capped at 0.4; the anchor 'rp' may exceed it.
    w = {"rp": 0.1, "mom": 0.7, "mr": 0.2}
    out = apply_weight_cap(w, max_weight=0.4, exempt="rp")
    assert out["mom"] <= 0.4 + 1e-9
    assert abs(sum(out.values()) - 1.0) < 1e-9


def test_weight_cap_redistributes_excess():
    w = {"rp": 0.05, "mom": 0.8, "mr": 0.15}
    out = apply_weight_cap(w, max_weight=0.4, exempt="rp")
    # Excess from mom flows to others; total preserved, mom capped.
    assert out["mom"] <= 0.4 + 1e-9
    assert out["rp"] > 0.05  # anchor absorbed some of the freed mass
    assert abs(sum(out.values()) - 1.0) < 1e-9


def test_degenerate_weights_fall_back_to_equal():
    out = hedge_update({"a": 0.0, "b": 0.0}, {"a": 0.0, "b": 0.0},
                       {"a": 0.0, "b": 0.0}, learning_rate=0.1)
    assert abs(out["a"] - 0.5) < 1e-9
    assert abs(out["b"] - 0.5) < 1e-9
