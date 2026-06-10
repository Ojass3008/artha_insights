# Artha Quant — meta-allocator compute service

The Python "brain" for the regime-aware, regret-minimizing meta-allocator.
It is intentionally separate from the React/Vite frontend: Python computes
decisions and writes them to Supabase; React reads and renders them.

## What this is (and is not)

This is **Phase 3.5** of the roadmap: the meta-layer that reweights strategies
based on regime-specific, reliability-adjusted performance — and falls back to a
risk-parity anchor when confidence is low.

It ships in **anchor-only mode by default** (`confidence_ceiling = 0.0`), which
means the system trades *pure risk parity* no matter what the meta-layer "wants."
This is mathematically safe from day one. You raise the ceiling only after the
meta-layer earns out-of-sample trust.

## Design principles (encoded in code, not just docs)

- **Pessimism by default.** Allocation uses the lower-confidence-bound (LCB)
  Sharpe, not the point estimate. We allocate to the *worst plausible* edge.
- **Reliability gates learning.** Thin-sample or unstable strategies barely move
  their weights even after a "win."
- **Confidence is a continuous dial**, not an on/off switch. `c -> 0` glides to
  the risk-parity anchor with no discontinuity.
- **Regret minimization, not return maximization.** Hedge / multiplicative
  weights with a provable `O(sqrt(T log N))` regret bound.
- **Loss aversion.** Single-strategy weight caps; rare regimes default to anchor.

## Layout

```
quant/
  artha_quant/
    __init__.py
    config.py          # all knobs in one place; anchor-only by default
    universe.py        # the multi-asset set (SPY, TLT, GLD, BTC) + classes
    data.py            # price loader: Yahoo v8 + deterministic synthetic fallback
    regime.py          # point-in-time soft regime probabilities (no lookahead)
    signals.py         # normalization: log returns, vol-scaling, simplex
    strategies.py      # the four experts (risk parity anchor + 3 alpha sleeves)
    ledger.py          # mini-backtester -> point-in-time strategy_returns ledger
    reliability.py     # LCB-Sharpe, empirical-Bayes shrinkage, stability
    hedge.py           # multiplicative-weights (Hedge) meta-update
    confidence.py      # system confidence c from its drivers
    meta_allocator.py  # ties it together: ledger -> weights -> final blend
    pipeline.py        # prices -> strategies -> ledger -> decision (one path)
    synthetic.py       # controlled ledger fixture for isolated meta-layer tests
    store.py           # Supabase read/write (optional; no-op without creds)
    run.py             # CLI entrypoint: run pipeline, print, optionally persist
  tests/               # 43 tests covering math, safety, and point-in-time-ness
  requirements.txt
```

## Quickstart

```bash
cd quant
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q                          # run the test suite (43 tests)
python -m artha_quant.run --demo   # offline synthetic prices, print decision
python -m artha_quant.run          # live prices (Yahoo), print only
python -m artha_quant.run --persist  # live + write ledger & decision to Supabase
```

## How it runs on a schedule

Two options (pick one — don't run both or you compute twice):

- **Vercel cron** (`api/cron/allocate.py`, wired in `vercel.json`): a thin
  Python serverless function that bundles `quant/` via `includeFiles` and runs
  daily at 12:00 UTC. Needs `requirements.txt` at the repo root (already added)
  and the Supabase + `CRON_SECRET` env vars in the Vercel dashboard.
- **GitHub Actions** (`.github/workflows/allocate.yml`) — recommended for
  numpy/pandas batch: no bundle-size limit, no cold start. Set the Supabase
  secrets in the repo and it runs `python -m artha_quant.run --persist` daily.

## Safety

`config.py` ships with `CONFIDENCE_CEILING = 0.0`. While that holds, every
final weight vector is the risk-parity anchor. Raising it is a deliberate,
auditable act.
