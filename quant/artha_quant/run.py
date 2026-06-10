"""Entrypoint: run the full pipeline, print the decision, optionally persist.

Usage:
  python -m artha_quant.run --demo          # offline synthetic prices, print only
  python -m artha_quant.run                 # live prices (Yahoo), print only
  python -m artha_quant.run --persist       # live + write ledger & decision to Supabase
  python -m artha_quant.run --demo --persist # offline data, still write (for testing DB)

The same pipeline runs in every mode — only the data source (--demo => no
network) and whether we persist differ. This is the function the Vercel cron
calls too, so batch and live cannot silently diverge.
"""

from __future__ import annotations

import argparse

from .config import Config
from .ledger import summarize
from .pipeline import run_pipeline
from .store import SupabaseStore


def _print_decision(run, cfg) -> None:
    d = run.decision
    print("=" * 72)
    print("ARTHA META-ALLOCATOR  ·  pipeline run")
    print("=" * 72)
    print(f"as_of            : {d.as_of}")
    print(f"active regime    : {d.active_regime}  "
          f"{ {k: round(v, 2) for k, v in d.regime_probs.items()} }")
    print(f"confidence (raw) : {d.confidence.c_raw:.3f}")
    print(f"confidence (eff) : {d.confidence.c_effective:.3f}  "
          f"(ceiling={cfg.confidence_ceiling:.2f})")
    print(f"anchor blend     : {d.confidence.anchor_blend:.3f}")
    print("-" * 72)
    print(f"{'strategy':<16}{'learned':>10}{'FINAL':>10}{'rho':>8}{'lcbSR':>8}")
    for s in d.strategies:
        print(
            f"{s:<16}"
            f"{d.weights_learned[s]:>10.3f}"
            f"{d.weights_final[s]:>10.3f}"
            f"{d.reliability.get(s, 0):>8.2f}"
            f"{d.lcb_sharpe.get(s, 0):>8.2f}"
        )
    print("-" * 72)
    print("net strategy performance (mini-backtest):")
    stats = summarize(run.backtest.equity)
    for name, row in stats.iterrows():
        print(
            f"  {name:<16} ann_ret={row['ann_return']:+.1%}  "
            f"vol={row['ann_vol']:.1%}  sharpe={row['sharpe']:+.2f}  "
            f"maxDD={row['max_drawdown']:.1%}"
        )
    print("-" * 72)
    print("reasoning:")
    print(" ", d.reasoning)
    print("=" * 72)


def main() -> None:
    parser = argparse.ArgumentParser(description="Artha meta-allocator runner")
    parser.add_argument("--demo", action="store_true",
                        help="use offline synthetic prices (no network)")
    parser.add_argument("--persist", action="store_true",
                        help="write ledger + decision to Supabase")
    args = parser.parse_args()

    cfg = Config()
    run = run_pipeline(cfg, allow_network=not args.demo)
    _print_decision(run, cfg)

    if args.persist:
        store = SupabaseStore()
        if not store.available:
            print("\n[persist] Supabase not configured — skipping write.")
            return
        n = store.persist_ledger(run.backtest.ledger)
        ok = store.persist_decision(run.decision)
        print(f"\n[persist] ledger rows: {n}  ·  decision written: {ok}")


if __name__ == "__main__":
    main()
