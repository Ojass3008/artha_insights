"""System confidence c in [0,1] and the continuous blend toward the anchor.

Confidence is NOT a binary on/off switch. It is a dial that smoothly glides the
final weights between the learned meta-weights (c -> 1) and the risk-parity
anchor (c -> 0). The system trusts itself precisely as much as the evidence
warrants, and degrades gracefully — never a discontinuous jump at the worst
possible moment.

Drivers (each mapped to [0,1], 1 = more confident):
  - regime certainty   : 1 - normalized entropy of the regime probabilities
  - strategy agreement : 1 - dispersion across the experts' weight vectors
  - mean reliability   : average rho of the currently active regime

c_raw = weighted blend of the drivers.
c_effective = min(c_raw, confidence_ceiling)  <-- the master safety cap.
anchor_blend = 1 - c_effective.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import Config


@dataclass
class ConfidenceResult:
    c_raw: float
    c_effective: float
    anchor_blend: float
    regime_entropy: float        # normalized [0,1]; high = uncertain
    strategy_dispersion: float   # [0,1]; high = experts disagree
    mean_reliability: float
    regime_certainty: float      # 1 - regime_entropy (for transparency)
    strategy_agreement: float    # 1 - strategy_dispersion


def normalized_entropy(probs: dict[str, float]) -> float:
    """Shannon entropy of a probability vector, normalized to [0,1].

    0 => one regime has all the mass (certain). 1 => uniform over regimes
    (maximally uncertain). Normalizing by log(k) makes it comparable across a
    varying number of regimes.
    """
    p = np.array([max(v, 0.0) for v in probs.values()], dtype=float)
    total = p.sum()
    if total <= 1e-12 or p.size <= 1:
        return 0.0
    p = p / total
    nz = p[p > 0]
    ent = -np.sum(nz * np.log(nz))
    return float(ent / np.log(p.size))


def weight_dispersion(weight_vectors: list[dict[str, float]]) -> float:
    """Disagreement among experts' target weight vectors, in [0,1].

    Each expert emits a vector of asset weights. We measure average pairwise
    L1 distance (total variation) across experts and normalize to [0,1] (max
    TV distance between two simplex points is 1). High => experts point in very
    different directions => we should lean on the anchor.
    """
    vecs = [v for v in weight_vectors if v]
    if len(vecs) < 2:
        return 0.0

    assets = sorted({a for v in vecs for a in v})
    mats = np.array([[v.get(a, 0.0) for a in assets] for v in vecs], dtype=float)
    # Normalize each expert's vector to sum to 1 (guard against unnormalized).
    sums = mats.sum(axis=1, keepdims=True)
    sums[sums <= 1e-12] = 1.0
    mats = mats / sums

    n = mats.shape[0]
    dists = []
    for i in range(n):
        for j in range(i + 1, n):
            # Total variation distance = 0.5 * L1.
            dists.append(0.5 * np.abs(mats[i] - mats[j]).sum())
    return float(np.clip(np.mean(dists), 0.0, 1.0))


def compute_confidence(
    regime_probs: dict[str, float],
    expert_weight_vectors: list[dict[str, float]],
    reliabilities: dict[str, float],
    active_regime: str,
    cfg: Config,
) -> ConfidenceResult:
    """Combine the drivers into system confidence and the anchor blend.

    `reliabilities` is the rho map for the active regime. The anchor's own
    reliability is excluded from the mean (it is the floor, not evidence that
    the meta-layer should be trusted).
    """
    entropy = normalized_entropy(regime_probs)
    regime_certainty = 1.0 - entropy

    dispersion = weight_dispersion(expert_weight_vectors)
    agreement = 1.0 - dispersion

    non_anchor = {
        s: r for s, r in reliabilities.items() if s != cfg.anchor_strategy
    }
    mean_rel = float(np.mean(list(non_anchor.values()))) if non_anchor else 0.0

    c_raw = float(
        cfg.w_regime_certainty * regime_certainty
        + cfg.w_strategy_agreement * agreement
        + cfg.w_reliability * mean_rel
    )
    c_raw = float(np.clip(c_raw, 0.0, 1.0))

    # Rare/dangerous regimes: lean harder on the anchor by halving confidence.
    # We will never have enough crisis samples to trust learned weights exactly
    # when the stakes are highest, so we de-rate confidence there by design.
    if active_regime in cfg.rare_regimes:
        c_raw *= 0.5

    # The master safety cap. In anchor-only mode (ceiling=0) this forces 0.
    c_effective = min(c_raw, cfg.confidence_ceiling)
    anchor_blend = 1.0 - c_effective

    return ConfidenceResult(
        c_raw=c_raw,
        c_effective=c_effective,
        anchor_blend=anchor_blend,
        regime_entropy=entropy,
        strategy_dispersion=dispersion,
        mean_reliability=mean_rel,
        regime_certainty=regime_certainty,
        strategy_agreement=agreement,
    )
