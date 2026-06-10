"""Reliability scoring: turn a noisy track record into a trust score in [0,1].

The meta-layer must NEVER reweight on raw Sharpe. A Sharpe of 2.0 computed on
15 lucky days is worthless; a Sharpe of 1.0 on 400 days is real. This module
encodes that intuition in three layers:

  1. LCB-Sharpe   — allocate on the pessimistic edge of the estimate, not the
                    point estimate. (Defends "avoid being very wrong".)
  2. Shrinkage    — empirical-Bayes pull toward the cross-strategy mean,
                    strong when samples are thin. (James-Stein logic.)
  3. Stability    — reward consistent edges, penalize lumpy ones.

Everything here is plain numpy so it is trivial to test and reason about.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import Config, TRADING_DAYS


@dataclass
class CellStats:
    """Decayed statistics for one (strategy, regime) cell of the ledger."""

    strategy: str
    regime: str
    eff_n: float          # effective (decay-weighted) sample size
    mean: float           # decayed mean per-period return
    std: float            # decayed std of per-period return
    sharpe: float         # annualized point-estimate Sharpe
    stability: float      # consistency in [0,1]; 1 = perfectly consistent edge


def _ewma_halflife_weights(n: int, halflife: float) -> np.ndarray:
    """Newest-last exponential weights for `n` ordered observations.

    Index n-1 is the most recent and gets the largest weight. Returns weights
    that sum to 1. A longer half-life => flatter weights => longer memory.
    """
    if n == 0:
        return np.zeros(0)
    if halflife <= 0:
        # Degenerate: only the most recent observation matters.
        w = np.zeros(n)
        w[-1] = 1.0
        return w
    decay = 0.5 ** (1.0 / halflife)
    # ages: most recent obs has age 0.
    ages = np.arange(n - 1, -1, -1, dtype=float)
    w = decay ** ages
    return w / w.sum()


def _effective_sample_size(weights: np.ndarray) -> float:
    """Kish effective sample size: (sum w)^2 / sum(w^2).

    For equal weights this is just n; for decayed weights it is smaller,
    correctly reflecting that old observations carry little information.
    """
    if weights.size == 0:
        return 0.0
    s1 = weights.sum()
    s2 = np.square(weights).sum()
    if s2 == 0:
        return 0.0
    return float((s1 * s1) / s2)


def compute_cell_stats(
    strategy: str,
    regime: str,
    returns: np.ndarray,
    cfg: Config,
) -> CellStats:
    """Decay-weighted stats for one (strategy, regime) cell.

    `returns` is ordered oldest-first. Returns are per-period (e.g. daily)
    decimals. Sharpe is annualized with sqrt(TRADING_DAYS).
    """
    returns = np.asarray(returns, dtype=float)
    n = returns.size
    if n == 0:
        return CellStats(strategy, regime, 0.0, 0.0, 0.0, 0.0, 0.0)

    w = _ewma_halflife_weights(n, cfg.return_halflife_days)
    eff_n = _effective_sample_size(w)

    mean = float(np.sum(w * returns))
    # Weighted variance (population form; eff_n correction applied in SE later).
    var = float(np.sum(w * (returns - mean) ** 2))
    std = float(np.sqrt(max(var, 0.0)))

    if std <= 1e-12:
        sharpe = 0.0
    else:
        sharpe = (mean / std) * np.sqrt(TRADING_DAYS)

    stability = _stability_score(returns, w)

    return CellStats(strategy, regime, eff_n, mean, std, sharpe, stability)


def _stability_score(returns: np.ndarray, weights: np.ndarray) -> float:
    """Consistency of the edge in [0,1]; 1 = perfectly consistent.

    We use a decayed *hit rate* (fraction of periods with the same sign as the
    mean), recentred so that pure noise (~50% hits) maps to ~0 and a perfectly
    one-directional edge maps to ~1. This is bounded and robust, unlike the std
    of rolling Sharpe which is unbounded and unfairly punishes legitimately
    volatile-but-real strategies.
    """
    n = returns.size
    if n < 5:
        # Too little data to judge consistency — neutral, let the gate decide.
        return 0.5
    mean = float(np.sum(weights * returns))
    if abs(mean) < 1e-12:
        return 0.5
    sign = np.sign(mean)
    hits = (np.sign(returns) == sign).astype(float)
    hit_rate = float(np.sum(weights * hits))  # decayed fraction of agreeing days
    # Recentre: 0.5 (coin flip) -> 0, 1.0 (always agrees) -> 1.
    return float(np.clip(2.0 * (hit_rate - 0.5), 0.0, 1.0))


def sharpe_standard_error(sharpe: float, eff_n: float) -> float:
    """Standard error of a Sharpe estimate.

    SE(SR) ≈ sqrt((1 + 0.5 * SR^2) / n)  (Lo, 2002, iid approximation; the
    annualization cancels because both SR and its SE scale the same way when
    expressed per-period — we keep SR annualized and use the annualized form
    consistently, which is fine for a relative trust score).
    """
    if eff_n <= 1:
        # No statistical resolution — return a large SE so the LCB is crushed.
        return abs(sharpe) + 10.0
    return float(np.sqrt((1.0 + 0.5 * sharpe * sharpe) / eff_n))


def lcb_sharpe(sharpe: float, eff_n: float, z: float) -> float:
    """Lower-confidence-bound Sharpe: SR - z * SE(SR).

    This is the pessimistic estimate we actually allocate on. A high Sharpe on
    thin data has a huge SE, so its LCB collapses — exactly the defense against
    performance-chasing into lucky strategies.
    """
    return sharpe - z * sharpe_standard_error(sharpe, eff_n)


def shrink_toward_mean(
    values: np.ndarray, eff_ns: np.ndarray, prior: float, shrink_k: float
) -> np.ndarray:
    """Empirical-Bayes shrinkage of per-strategy values toward a prior.

    shrink_amount_i = shrink_k / (shrink_k + eff_n_i), so thin-sample cells are
    pulled hard toward `prior` (typically the cross-strategy mean), while
    well-sampled cells keep most of their own signal.
    """
    values = np.asarray(values, dtype=float)
    eff_ns = np.asarray(eff_ns, dtype=float)
    shrink = shrink_k / (shrink_k + np.maximum(eff_ns, 0.0))
    return (1.0 - shrink) * values + shrink * prior


def reliability_scores(
    cells: list[CellStats], cfg: Config
) -> dict[str, float]:
    """Map each strategy's cell (within ONE regime) to a reliability rho in [0,1].

    Pipeline:
      1. LCB-Sharpe per cell (pessimism).
      2. Shrink LCB-Sharpes toward their cross-strategy mean (low-sample pull).
      3. Squash to [0,1] and multiply by:
           - a sample-size gate (kills thin cells), and
           - a stability factor (penalizes lumpy performance).

    Returns {strategy: rho}. Higher rho => the meta-layer is allowed to lean on
    this strategy more (rho multiplies the Hedge learning update).
    """
    if not cells:
        return {}

    sharpes = np.array([c.sharpe for c in cells], dtype=float)
    eff_ns = np.array([c.eff_n for c in cells], dtype=float)

    # 1. Pessimistic estimate.
    lcb = np.array(
        [lcb_sharpe(c.sharpe, c.eff_n, cfg.sharpe_lcb_z) for c in cells],
        dtype=float,
    )

    # 2. Shrink toward the cross-strategy mean LCB (the "no special edge" prior).
    prior = float(np.mean(lcb)) if lcb.size else 0.0
    shrunk = shrink_toward_mean(lcb, eff_ns, prior, cfg.shrink_k)

    out: dict[str, float] = {}
    for c, sh in zip(cells, shrunk):
        # 3a. Squash shrunk LCB-Sharpe into [0,1] via a logistic. An LCB-Sharpe
        # of 0 maps to 0.5 (neutral); strongly negative -> ~0; strongly
        # positive -> ~1. The scale (1.0) keeps it gentle.
        base = 1.0 / (1.0 + np.exp(-sh))

        # 3b. Sample-size gate: below min_effective_n, crush toward 0. We use a
        # QUADRATIC ramp, not linear: the SE formula is a large-n approximation
        # that under-penalizes tiny samples sporting absurd in-sample Sharpes,
        # so the gate must do the heavy lifting. A cell with 8 samples vs a
        # 20-sample floor gets (8/20)^2 = 0.16, not 0.40.
        gate = float(np.clip(c.eff_n / cfg.min_effective_n, 0.0, 1.0)) ** 2

        # 3c. Stability factor: reward consistent edges directly. stability is
        # already in [0,1]; we floor it so a single noisy-but-well-sampled
        # strategy is not zeroed out entirely.
        stab = 0.25 + 0.75 * c.stability

        rho = float(np.clip(base * gate * stab, 0.0, 1.0))
        out[c.strategy] = rho

    return out
