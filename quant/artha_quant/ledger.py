"""Ledger builder — the mini-backtester that produces strategy_returns.

This is what gives the meta-layer something real to learn from. It walks
forward through history one bar at a time and, for each strategy:

  1. Asks the strategy for target weights using ONLY data up to bar t
     (point-in-time; the strategy never sees bar t+1).
  2. Realizes the next-bar return of those weights.
  3. Charges transaction costs proportional to turnover (an optimizer that
     churns looks great gross and dies net — costs are not optional).
  4. Tags the realized return with the regime the engine believed at bar t.

The output is the long-format DataFrame the MetaAllocator consumes, plus an
equity curve per strategy for inspection. The same target_weights() code path
runs here and in live — never two implementations that can silently diverge.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import signals
from .regime import hard_label, regime_probabilities
from .strategies import Strategy, default_strategies


# Round-trip cost assumptions. Conservative-ish for liquid ETFs; crypto would
# realistically be higher. One number per book for this phase.
DEFAULT_COST_BPS = 5.0  # 5 bps charged on the traded notional (sum of |dw|)


@dataclass
class BacktestResult:
    ledger: pd.DataFrame                 # long: strategy, as_of, ret, regime, regime_probs
    equity: pd.DataFrame                 # wide: cumulative net equity per strategy
    regime_probs: pd.DataFrame           # per-day regime probability vectors


def build_ledger(
    prices: pd.DataFrame,
    strategies: list[Strategy] | None = None,
    *,
    cost_bps: float = DEFAULT_COST_BPS,
    warmup: int = 200,
) -> BacktestResult:
    """Walk forward, producing the point-in-time strategy return ledger.

    `warmup` skips the initial window where long-lookback signals (e.g. 12-1
    momentum, 200d trend) are not yet defined — trading them earlier would be
    acting on undefined signals.
    """
    strategies = strategies or default_strategies()
    asset_rets = signals.log_returns(prices)
    regimes = regime_probabilities(prices)

    rows: list[dict] = []
    prev_weights: dict[str, dict[str, float]] = {s.name: {} for s in strategies}
    equity_curves: dict[str, list[float]] = {s.name: [] for s in strategies}
    equity_dates: list[pd.Timestamp] = []

    n = len(prices)
    for t in range(warmup, n - 1):  # need t+1 to realize the return
        dt = prices.index[t]
        next_dt = prices.index[t + 1]
        regime_row = regimes.loc[dt]
        label = hard_label(regime_row)
        probs = {k: float(regime_row[k]) for k in regimes.columns}

        # Next-bar simple returns for realization (exp of log return).
        next_log = asset_rets.iloc[t + 1]
        next_simple = np.expm1(next_log)

        for strat in strategies:
            w = strat.target_weights(prices, t)

            # Gross portfolio return over the next bar.
            gross = sum(w.get(s, 0.0) * float(next_simple.get(s, 0.0)) for s in w)

            # Turnover cost vs the previous day's weights.
            turnover = _turnover(prev_weights[strat.name], w)
            cost = turnover * (cost_bps / 1e4)
            net = gross - cost

            rows.append(
                {
                    "strategy": strat.name,
                    "as_of": next_dt.date(),  # the day the return is realized
                    "ret": float(net),
                    "regime": label,           # regime believed AT decision time t
                    "regime_probs": probs,
                }
            )

            prev_weights[strat.name] = w
            prev_eq = equity_curves[strat.name][-1] if equity_curves[strat.name] else 1.0
            equity_curves[strat.name].append(prev_eq * (1.0 + net))

        equity_dates.append(next_dt)

    ledger = pd.DataFrame(rows)
    equity = pd.DataFrame(equity_curves, index=pd.to_datetime(equity_dates))
    return BacktestResult(ledger=ledger, equity=equity, regime_probs=regimes)


def _turnover(prev: dict[str, float], cur: dict[str, float]) -> float:
    """Sum of absolute weight changes — the notional traded to rebalance.

    First rebalance from cash charges the full cost of establishing the book.
    """
    keys = set(prev) | set(cur)
    return sum(abs(cur.get(k, 0.0) - prev.get(k, 0.0)) for k in keys)


def summarize(equity: pd.DataFrame) -> pd.DataFrame:
    """Quick net performance stats per strategy (annualized)."""
    rets = equity.pct_change().dropna()
    out = {}
    for col in equity.columns:
        r = rets[col]
        ann_ret = (1 + r).prod() ** (252 / len(r)) - 1 if len(r) else 0.0
        ann_vol = r.std() * np.sqrt(252)
        sharpe = ann_ret / ann_vol if ann_vol > 1e-9 else 0.0
        peak = equity[col].cummax()
        max_dd = float((equity[col] / peak - 1.0).min())
        out[col] = {
            "ann_return": float(ann_ret),
            "ann_vol": float(ann_vol),
            "sharpe": float(sharpe),
            "max_drawdown": max_dd,
        }
    return pd.DataFrame(out).T
