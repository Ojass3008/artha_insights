"""End-to-end meta-allocator tests — the safety-critical behaviours."""

from datetime import date

import numpy as np
import pandas as pd

from artha_quant.config import Config
from artha_quant.meta_allocator import MetaAllocator
from artha_quant.synthetic import build_synthetic_ledger


def _regime_probs():
    return {"risk_on": 0.6, "neutral": 0.3, "risk_off": 0.1}


def test_anchor_only_mode_trades_pure_anchor():
    """The headline safety guarantee: ceiling=0 => final weights == anchor."""
    cfg = Config()  # anchor-only
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs=_regime_probs(),
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    assert abs(d.weights_final[cfg.anchor_strategy] - 1.0) < 1e-9
    for s in d.strategies:
        if s != cfg.anchor_strategy:
            assert abs(d.weights_final[s]) < 1e-9


def test_learned_weights_can_differ_from_final_in_anchor_mode():
    """Meta-layer still computes a *view*; it just isn't traded yet."""
    cfg = Config()
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs=_regime_probs(),
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    # The learned vector should NOT be all-anchor (it has opinions),
    # demonstrating the layer is alive under the hood.
    assert d.weights_learned[cfg.anchor_strategy] < 0.999


def test_final_weights_sum_to_one_when_confidence_on():
    cfg = Config(confidence_ceiling=0.5)
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs=_regime_probs(),
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    assert abs(sum(d.weights_final.values()) - 1.0) < 1e-9
    # With confidence on, the anchor no longer holds 100%.
    assert d.weights_final[cfg.anchor_strategy] < 0.999


def test_noisy_strategy_earns_low_reliability():
    """sentiment_tilt is engineered to be weak/noisy -> low rho."""
    cfg = Config(confidence_ceiling=1.0)
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs=_regime_probs(),
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    # The noisy sleeve should be among the least reliable / least weighted
    # of the non-anchor strategies.
    assert d.reliability["sentiment_tilt"] <= d.reliability["ts_momentum"] + 1e-9


def test_weight_cap_holds_under_full_confidence():
    cfg = Config(confidence_ceiling=1.0, max_strategy_weight=0.4)
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs={"risk_on": 1.0},
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    # No non-anchor strategy may exceed the cap in the LEARNED vector.
    for s, w in d.weights_learned.items():
        if s != cfg.anchor_strategy:
            assert w <= cfg.max_strategy_weight + 1e-6


def test_reasoning_is_populated():
    cfg = Config()
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs=_regime_probs(),
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    assert "ANCHOR-ONLY" in d.reasoning
    assert d.active_regime == "risk_on"


def test_missing_anchor_degrades_to_equal_weight():
    """If the anchor is absent from the ledger, fail safe, not silent-risky."""
    cfg = Config(anchor_strategy="not_present")
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs=_regime_probs(),
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    # Anchor-only blend with a missing anchor -> equal weights, summing to 1.
    assert abs(sum(d.weights_final.values()) - 1.0) < 1e-9
    vals = list(d.weights_final.values())
    assert max(vals) - min(vals) < 1e-9


def test_empty_regime_probs_does_not_crash():
    cfg = Config()
    alloc = MetaAllocator(cfg)
    ledger = build_synthetic_ledger()
    d = alloc.decide(
        ledger=ledger,
        regime_probs={},
        expert_weight_vectors={},
        as_of=date(2024, 12, 27),
    )
    assert abs(sum(d.weights_final.values()) - 1.0) < 1e-9
