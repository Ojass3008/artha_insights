"""MetaAllocator — ties the ledger, reliability, Hedge, and confidence together.

Flow for a single decision at date `as_of`:

  1. From the return ledger, build per-regime (strategy x regime) cell stats.
  2. Per regime, compute reliability rho and run the Hedge update to get the
     regime's learned strategy weights, capped per strategy.
  3. Partial-pool each regime's weights toward the all-regime average when that
     regime is thinly sampled (a fresh crisis starts from "what works
     generally", not a blank slate).
  4. Soft-mix across regimes by the live regime probabilities P(k):
        w_learned = sum_k P(k) * w_k
     This eliminates whipsaw at regime boundaries.
  5. Compute system confidence c and blend toward the risk-parity anchor:
        w_final = c * w_learned + (1 - c) * w_anchor
  6. Emit the decision with full reasoning for the explainability layer.

In anchor-only mode (confidence_ceiling = 0) step 5 always returns the anchor,
so the system is provably safe while you accumulate trust.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pandas as pd

from .config import Config, DEFAULT_CONFIG
from .confidence import ConfidenceResult, compute_confidence
from .hedge import apply_weight_cap, hedge_update
from .reliability import CellStats, compute_cell_stats, lcb_sharpe, reliability_scores


@dataclass
class MetaDecision:
    """The full, auditable output of one allocation run."""

    as_of: date
    strategies: list[str]
    weights_learned: dict[str, float]   # what the meta-layer wants
    weights_final: dict[str, float]     # after confidence blend (what we trade)
    reliability: dict[str, float]       # soft-mixed rho per strategy
    lcb_sharpe: dict[str, float]        # soft-mixed pessimistic Sharpe per strategy
    confidence: ConfidenceResult
    active_regime: str
    regime_probs: dict[str, float]
    reasoning: str = ""                 # human-readable explanation


class MetaAllocator:
    """Stateful meta-allocator. Holds config; recomputes decisions on demand."""

    def __init__(self, cfg: Config | None = None) -> None:
        self.cfg = cfg or DEFAULT_CONFIG

    # ---- public API --------------------------------------------------------

    def decide(
        self,
        ledger: pd.DataFrame,
        regime_probs: dict[str, float],
        expert_weight_vectors: dict[str, dict[str, float]],
        as_of: date,
        prior_weights: dict[str, dict[str, float]] | None = None,
    ) -> MetaDecision:
        """Produce one allocation decision.

        Parameters
        ----------
        ledger
            Long-format DataFrame with columns: strategy, as_of, ret, regime.
            Each row is one strategy's realized return on one day, tagged with
            the POINT-IN-TIME regime active that day.
        regime_probs
            Live regime probability vector P(k) for `as_of`.
        expert_weight_vectors
            {strategy: {asset: weight}} — each strategy's current target asset
            weights. Used only for the disagreement driver of confidence here;
            the asset-level blend is done downstream.
        as_of
            Decision date.
        prior_weights
            Optional {regime: {strategy: weight}} carried from the previous run,
            so Hedge updates multiplicatively instead of restarting each day.
            If None, each regime starts from equal weights.
        """
        cfg = self.cfg
        strategies = sorted(ledger["strategy"].unique().tolist())
        regimes = sorted(ledger["regime"].unique().tolist())
        # Make sure any regime we have a live probability for is represented.
        for k in regime_probs:
            if k not in regimes:
                regimes.append(k)

        # 1-3: per-regime learned weights (capped + partial-pooled).
        per_regime_weights, per_regime_rho, per_regime_lcb = self._per_regime(
            ledger, strategies, regimes, prior_weights
        )

        # 4: soft-mix across regimes by P(k).
        w_learned = self._soft_mix(per_regime_weights, regime_probs, strategies)
        rho_mixed = self._soft_mix(per_regime_rho, regime_probs, strategies)
        lcb_mixed = self._soft_mix(per_regime_lcb, regime_probs, strategies)

        active_regime = (
            max(regime_probs, key=regime_probs.get) if regime_probs else "unknown"
        )

        # 5: confidence + anchor blend.
        conf = compute_confidence(
            regime_probs=regime_probs,
            expert_weight_vectors=list(expert_weight_vectors.values()),
            reliabilities=per_regime_rho.get(active_regime, rho_mixed),
            active_regime=active_regime,
            cfg=cfg,
        )
        w_final = self._blend_to_anchor(w_learned, conf.c_effective, strategies)

        decision = MetaDecision(
            as_of=as_of,
            strategies=strategies,
            weights_learned=w_learned,
            weights_final=w_final,
            reliability=rho_mixed,
            lcb_sharpe=lcb_mixed,
            confidence=conf,
            active_regime=active_regime,
            regime_probs=regime_probs,
        )
        decision.reasoning = self._explain(decision)
        return decision

    # ---- internals ---------------------------------------------------------

    def _per_regime(
        self,
        ledger: pd.DataFrame,
        strategies: list[str],
        regimes: list[str],
        prior_weights: dict[str, dict[str, float]] | None,
    ) -> tuple[dict, dict, dict]:
        """Compute learned weights, rho, and lcb-Sharpe for every regime."""
        cfg = self.cfg
        per_regime_weights: dict[str, dict[str, float]] = {}
        per_regime_rho: dict[str, dict[str, float]] = {}
        per_regime_lcb: dict[str, dict[str, float]] = {}

        # All-regime cell stats per strategy, used as the partial-pooling target.
        global_cells = {
            s: compute_cell_stats(
                s, "_all", _ordered_returns(ledger, s, regime=None), cfg
            )
            for s in strategies
        }

        for k in regimes:
            cells = [
                compute_cell_stats(
                    s, k, _ordered_returns(ledger, s, regime=k), cfg
                )
                for s in strategies
            ]
            rho = reliability_scores(cells, cfg)
            lcb = {
                c.strategy: lcb_sharpe(c.sharpe, c.eff_n, cfg.sharpe_lcb_z)
                for c in cells
            }

            # Performance score for Hedge: the pessimistic (LCB) Sharpe, squashed
            # to ~[-1,1] so the learning rate behaves predictably.
            scores = {s: float(np.tanh(lcb[s])) for s in strategies}

            start = (
                prior_weights.get(k)
                if prior_weights and k in prior_weights
                else {s: 1.0 / len(strategies) for s in strategies}
            )
            learned = hedge_update(start, scores, rho, cfg.learning_rate)
            learned = apply_weight_cap(
                learned, cfg.max_strategy_weight, exempt=cfg.anchor_strategy
            )

            # Partial pooling toward the all-regime average for thin regimes.
            learned = self._pool_toward_global(
                learned, cells, global_cells, strategies
            )

            per_regime_weights[k] = learned
            per_regime_rho[k] = rho
            per_regime_lcb[k] = lcb

        return per_regime_weights, per_regime_rho, per_regime_lcb

    def _pool_toward_global(
        self,
        regime_weights: dict[str, float],
        cells: list[CellStats],
        global_cells: dict[str, CellStats],
        strategies: list[str],
    ) -> dict[str, float]:
        """Blend a regime's weights toward the all-regime weights when thin.

        Pool strength uses the regime's total effective sample size: few
        samples => pull hard toward the global behaviour. The global target is
        an inverse-vol-ish prior derived from all-regime reliability, which for
        an unsampled regime keeps us close to the broadly-sensible allocation.
        """
        cfg = self.cfg
        total_eff_n = sum(c.eff_n for c in cells)
        pool = cfg.regime_pool_k / (cfg.regime_pool_k + total_eff_n)

        # Global target: reliability-weighted, falling back to equal weight.
        g_rho = reliability_scores(list(global_cells.values()), cfg)
        g_sum = sum(g_rho.values())
        if g_sum <= 1e-12:
            global_w = {s: 1.0 / len(strategies) for s in strategies}
        else:
            global_w = {s: g_rho.get(s, 0.0) / g_sum for s in strategies}

        pooled = {
            s: (1.0 - pool) * regime_weights.get(s, 0.0)
            + pool * global_w.get(s, 0.0)
            for s in strategies
        }
        total = sum(pooled.values())
        if total <= 1e-12:
            return {s: 1.0 / len(strategies) for s in strategies}
        return {s: v / total for s, v in pooled.items()}

    def _soft_mix(
        self,
        per_regime: dict[str, dict[str, float]],
        regime_probs: dict[str, float],
        strategies: list[str],
    ) -> dict[str, float]:
        """Mix per-regime maps by P(k): sum_k P(k) * map_k."""
        if not regime_probs:
            # No live regime info: average across regimes we know about.
            regime_probs = {k: 1.0 / len(per_regime) for k in per_regime}

        total_p = sum(regime_probs.values()) or 1.0
        mixed = {s: 0.0 for s in strategies}
        for k, p in regime_probs.items():
            w = per_regime.get(k)
            if not w:
                continue
            pn = p / total_p
            for s in strategies:
                mixed[s] += pn * w.get(s, 0.0)
        return mixed

    def _blend_to_anchor(
        self, w_learned: dict[str, float], c: float, strategies: list[str]
    ) -> dict[str, float]:
        """w_final = c * w_learned + (1 - c) * w_anchor.

        The anchor vector places all weight on the anchor strategy. When c=0
        (anchor-only mode) this returns the pure anchor allocation.
        """
        cfg = self.cfg
        anchor = cfg.anchor_strategy
        if anchor not in strategies:
            # Anchor missing from the ledger — degrade to equal weight rather
            # than silently trading the learned vector. Loud-ish but safe.
            anchor_vec = {s: 1.0 / len(strategies) for s in strategies}
        else:
            anchor_vec = {s: (1.0 if s == anchor else 0.0) for s in strategies}

        blended = {
            s: c * w_learned.get(s, 0.0) + (1.0 - c) * anchor_vec[s]
            for s in strategies
        }
        total = sum(blended.values())
        if total <= 1e-12:
            return anchor_vec
        return {s: v / total for s, v in blended.items()}

    def _explain(self, d: MetaDecision) -> str:
        """Human-readable reasoning for the explainability layer."""
        cfg = self.cfg
        conf = d.confidence
        lines: list[str] = []

        if conf.c_effective <= 1e-9:
            lines.append(
                f"ANCHOR-ONLY: confidence ceiling is {cfg.confidence_ceiling:.0%}, "
                f"so capital is allocated entirely via the '{cfg.anchor_strategy}' "
                f"baseline regardless of the meta-layer's view."
            )
        else:
            lines.append(
                f"Confidence {conf.c_effective:.0%} -> blending "
                f"{conf.c_effective:.0%} learned / {conf.anchor_blend:.0%} anchor."
            )

        lines.append(
            f"Active regime '{d.active_regime}' "
            f"(certainty {conf.regime_certainty:.0%}, "
            f"expert agreement {conf.strategy_agreement:.0%}, "
            f"mean reliability {conf.mean_reliability:.2f})."
        )

        # Top contributors by final weight (excluding the anchor for color).
        ranked = sorted(
            ((s, w) for s, w in d.weights_final.items()),
            key=lambda kv: kv[1],
            reverse=True,
        )
        top = ", ".join(
            f"{s} {w:.0%} (rho={d.reliability.get(s, 0.0):.2f}, "
            f"lcbSR={d.lcb_sharpe.get(s, 0.0):.2f})"
            for s, w in ranked[:4]
        )
        lines.append(f"Top allocations: {top}.")

        if d.active_regime in cfg.rare_regimes:
            lines.append(
                f"'{d.active_regime}' is a rare regime; confidence de-rated by "
                "design, leaning harder on the anchor."
            )

        return " ".join(lines)


def _ordered_returns(
    ledger: pd.DataFrame, strategy: str, regime: str | None
) -> np.ndarray:
    """Oldest-first return array for a strategy, optionally within a regime."""
    df = ledger[ledger["strategy"] == strategy]
    if regime is not None:
        df = df[df["regime"] == regime]
    if df.empty:
        return np.zeros(0)
    df = df.sort_values("as_of")
    return df["ret"].to_numpy(dtype=float)
