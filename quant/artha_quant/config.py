"""Central configuration for the meta-allocator.

Every behavioural knob lives here so the system is auditable at a glance.
The defaults are deliberately *conservative*: the system ships in anchor-only
mode and only departs from risk parity once you raise CONFIDENCE_CEILING.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# Annualization factor for daily data. 252 trading days is the convention.
TRADING_DAYS = 252


@dataclass(frozen=True)
class Config:
    """Immutable bundle of tuning parameters.

    Treat half-lives and the learning rate as RISK parameters, not as knobs to
    maximize backtest Sharpe. Cranking the learning rate after a bad month is
    exactly the behavioural trap this whole architecture exists to avoid.
    """

    # ---- The anchor (safety floor) ----------------------------------------
    # Name of the strategy that doubles as the fallback. It must be present in
    # the ledger. Risk parity / inverse-vol is the natural choice: concentrating
    # into it is safe, unlike concentrating into a fragile alpha sleeve.
    anchor_strategy: str = "risk_parity"

    # ---- Confidence ceiling (the master safety switch) --------------------
    # Effective confidence is capped at this value. 0.0 => the system ALWAYS
    # trades the anchor regardless of what the meta-layer wants. Raise this
    # slowly (e.g. 0.25, then 0.5) only after the meta-layer earns live,
    # out-of-sample trust. This is the single most important safety control.
    confidence_ceiling: float = 0.0

    # ---- Reliability scoring ----------------------------------------------
    # z used for the lower-confidence-bound Sharpe. ~1.0 ≈ 1 std of pessimism.
    # Higher => more pessimistic => allocates to the worse plausible edge.
    sharpe_lcb_z: float = 1.0

    # Empirical-Bayes shrinkage strength. Effective shrinkage for a cell with
    # n samples is shrink_k / (shrink_k + n): low-sample cells get pulled hard
    # toward the cross-strategy mean Sharpe.
    shrink_k: float = 60.0

    # Below this effective sample size a (strategy, regime) cell is considered
    # statistically meaningless; its reliability is forced toward zero so the
    # meta-layer cannot get clever on thin data (esp. rare crisis regimes).
    min_effective_n: float = 20.0

    # Half-life (in active days within a regime) for the exponential decay of
    # the return ledger. Longer => steadier, slower to adapt. Shorter => chases
    # noise. Non-stationarity argues for finite memory; overfitting argues long.
    return_halflife_days: float = 126.0  # ~6 months of active days

    # Weight of the stability penalty (consistency of rolling performance).
    # 0 => ignore consistency; 1 => heavily reward smooth, repeatable edges.
    stability_weight: float = 0.5

    # ---- Hedge (multiplicative weights) -----------------------------------
    # Learning rate. LOW by default: stability and low self-regret over
    # reactivity. This is a risk control, not a performance knob.
    learning_rate: float = 0.10

    # Per-strategy cap on the LEARNED meta-weight (no single point of failure).
    # The anchor is exempt — concentrating into risk parity is safe.
    max_strategy_weight: float = 0.40

    # ---- Regime handling ---------------------------------------------------
    # Partial-pooling strength: how strongly a regime's weights are blended
    # toward the all-regime average when that regime has few samples. Prevents
    # a fresh crisis from starting from a blank slate.
    regime_pool_k: float = 40.0

    # Regimes considered "rare/dangerous": for these we lean harder on the
    # anchor by design, because we will never have enough samples to trust
    # learned weights exactly when the stakes are highest.
    rare_regimes: tuple[str, ...] = ("crisis",)

    # ---- Confidence drivers (weights must sum to 1) -----------------------
    # How much each driver contributes to raw system confidence c_raw.
    w_regime_certainty: float = 0.34   # 1 - normalized entropy of P(k)
    w_strategy_agreement: float = 0.33  # 1 - dispersion across expert weights
    w_reliability: float = 0.33         # mean reliability of the active regime

    def __post_init__(self) -> None:
        # Fail loud on misconfiguration rather than silently mis-weighting.
        s = self.w_regime_certainty + self.w_strategy_agreement + self.w_reliability
        if abs(s - 1.0) > 1e-6:
            raise ValueError(
                f"Confidence driver weights must sum to 1.0, got {s:.6f}"
            )
        if not 0.0 <= self.confidence_ceiling <= 1.0:
            raise ValueError("confidence_ceiling must be in [0, 1]")
        if not 0.0 < self.max_strategy_weight <= 1.0:
            raise ValueError("max_strategy_weight must be in (0, 1]")
        if self.learning_rate < 0:
            raise ValueError("learning_rate must be >= 0")


# A ready-to-use, safe default instance.
DEFAULT_CONFIG = Config()
