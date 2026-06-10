"""End-to-end pipeline: prices -> strategies -> ledger -> meta decision.

This is the single function the scheduler (Vercel cron) and the CLI both call,
so live and batch share one code path. It is deliberately pure: it returns the
artefacts and lets the caller decide whether to persist.

    prices = load_prices()                # data layer (Yahoo or synthetic)
    bt = build_ledger(prices, ...)        # mini-backtester -> point-in-time ledger
    decision = MetaAllocator().decide(...) # reliability + Hedge + confidence blend

The live regime probabilities handed to the meta-layer are the engine's most
recent point-in-time vector — the same object stored in the ledger, so there is
no train/serve skew in how regimes are represented.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pandas as pd

from .config import Config, DEFAULT_CONFIG
from .data import load_prices
from .ledger import BacktestResult, build_ledger
from .meta_allocator import MetaAllocator, MetaDecision
from .strategies import default_strategies


@dataclass
class PipelineRun:
    decision: MetaDecision
    backtest: BacktestResult
    prices: pd.DataFrame


def run_pipeline(
    cfg: Config | None = None,
    *,
    allow_network: bool = True,
    lookback_days: int = 800,
    seed: int = 11,
) -> PipelineRun:
    cfg = cfg or DEFAULT_CONFIG
    prices = load_prices(lookback_days=lookback_days, allow_network=allow_network, seed=seed)

    strategies = default_strategies()
    bt = build_ledger(prices, strategies)

    # Live regime view = the most recent point-in-time probability row.
    last_dt = bt.regime_probs.index[-1]
    regime_row = bt.regime_probs.loc[last_dt]
    regime_probs = {k: float(regime_row[k]) for k in bt.regime_probs.columns}

    # Current target weight vector per strategy (as of the last usable bar),
    # used by the confidence layer's disagreement driver.
    t_last = len(prices) - 1
    expert_vecs = {s.name: s.target_weights(prices, t_last) for s in strategies}

    alloc = MetaAllocator(cfg)
    decision = alloc.decide(
        ledger=bt.ledger[["strategy", "as_of", "ret", "regime"]],
        regime_probs=regime_probs,
        expert_weight_vectors=expert_vecs,
        as_of=max(bt.ledger["as_of"]),
    )

    return PipelineRun(decision=decision, backtest=bt, prices=prices)
