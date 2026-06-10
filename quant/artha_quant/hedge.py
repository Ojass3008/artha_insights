"""Hedge / multiplicative-weights meta-update with regret minimization.

This is the algorithm that gives the system its defining property: bounded
regret. Over T periods with N experts, cumulative regret vs the best expert in
hindsight grows like O(sqrt(T log N)). In plain terms: we mathematically cannot
trail our best strategy by much, and we never had to pick it in advance.

We make two domain-specific modifications to vanilla Hedge:

  1. Reliability-gated learning. The update exponent is scaled by each
     strategy's reliability rho. An unreliable strategy barely moves its weight
     even after a "win" — learning is throttled by trust.

  2. Per-strategy weight cap (the anchor exempt). Even if Hedge wants to pile
     into one sleeve, a hard ceiling enforces "no single point of failure".
"""

from __future__ import annotations

import numpy as np


def hedge_update(
    weights: dict[str, float],
    scores: dict[str, float],
    reliability: dict[str, float],
    learning_rate: float,
) -> dict[str, float]:
    """One multiplicative-weights step.

    Parameters
    ----------
    weights
        Current meta-weights per strategy (need not be normalized; we
        renormalize on output). Missing strategies are treated as having the
        average current weight so newcomers start neutral.
    scores
        Per-strategy performance score for the period, expected in roughly
        [-1, 1] (e.g. a clipped, risk-adjusted return). Higher is better.
    reliability
        rho in [0,1] per strategy; gates how much the score moves the weight.
    learning_rate
        eta >= 0. Low => stable/slow. This is a risk control, not a perf knob.

    Returns
    -------
    Normalized weights (sum to 1) after the update.
    """
    if not weights:
        return {}

    strategies = list(weights.keys())
    avg_w = float(np.mean(list(weights.values()))) if weights else 0.0

    updated: dict[str, float] = {}
    for s in strategies:
        w = weights.get(s, avg_w)
        score = scores.get(s, 0.0)
        rho = reliability.get(s, 0.0)
        # Reliability gates the exponent: untrusted strategies barely move.
        exponent = learning_rate * rho * score
        # Clip the exponent for numerical safety (avoid overflow on bad input).
        exponent = float(np.clip(exponent, -10.0, 10.0))
        updated[s] = max(w, 1e-12) * np.exp(exponent)

    return _normalize(updated)


def apply_weight_cap(
    weights: dict[str, float],
    max_weight: float,
    exempt: str | None = None,
) -> dict[str, float]:
    """Cap any single strategy's weight at `max_weight`, redistributing excess.

    `exempt` (the anchor) is allowed to exceed the cap — concentrating into
    risk parity is safe. Uses iterative water-filling so the redistributed mass
    does not push another strategy over the cap.
    """
    if not weights:
        return {}
    w = _normalize(weights)

    # Iterate: clamp violators, spread the freed mass over the uncapped ones.
    for _ in range(100):
        over = {
            s: v
            for s, v in w.items()
            if s != exempt and v > max_weight + 1e-12
        }
        if not over:
            break
        excess = sum(v - max_weight for v in over.values())
        for s in over:
            w[s] = max_weight
        # Recipients: strategies not at the cap and not the just-capped ones.
        recipients = [
            s
            for s, v in w.items()
            if s not in over and (s == exempt or v < max_weight - 1e-12)
        ]
        if not recipients:
            # Everyone is capped; give the remainder to the exempt anchor if
            # present, else leave it (renormalize will handle it).
            if exempt and exempt in w:
                w[exempt] += excess
            break
        recip_total = sum(w[s] for s in recipients)
        if recip_total <= 1e-12:
            share = excess / len(recipients)
            for s in recipients:
                w[s] += share
        else:
            for s in recipients:
                w[s] += excess * (w[s] / recip_total)

    return _normalize(w)


def _normalize(weights: dict[str, float]) -> dict[str, float]:
    """Project onto the simplex (non-negative, sums to 1)."""
    clipped = {s: max(v, 0.0) for s, v in weights.items()}
    total = sum(clipped.values())
    if total <= 1e-12:
        # Degenerate: fall back to equal weights.
        n = len(clipped)
        return {s: 1.0 / n for s in clipped} if n else {}
    return {s: v / total for s, v in clipped.items()}
