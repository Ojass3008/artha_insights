"""Synthetic fixtures for tests and isolated meta-layer checks.

`build_synthetic_ledger` produces a controlled strategy-return ledger with KNOWN
regime-conditional behaviour, so meta-layer tests can assert on reliability and
weighting WITHOUT depending on the full price->strategy pipeline. Keeping it
here (not in run.py) cleanly separates "test the meta-layer in isolation" from
"run the real pipeline".
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd


def build_synthetic_ledger(seed: int = 7) -> pd.DataFrame:
    """A small, regime-tagged ledger with deliberately distinct strategies:

      - risk_parity    : steady, low vol everywhere (the anchor)
      - ts_momentum    : strong in 'risk_on', poor in 'risk_off'
      - mean_reversion : strong in 'neutral', poor in trends
      - sentiment_tilt : genuinely noisy/weak -> should earn LOW reliability
    """
    rng = np.random.default_rng(seed)
    start = date(2024, 1, 1)
    n_days = 360
    regimes_seq = rng.choice(
        ["risk_on", "neutral", "risk_off"], size=n_days, p=[0.45, 0.40, 0.15]
    )

    profile = {
        "risk_parity": {
            "risk_on": (0.08, 0.08),
            "neutral": (0.05, 0.07),
            "risk_off": (0.02, 0.09),
        },
        "ts_momentum": {
            "risk_on": (0.25, 0.14),
            "neutral": (0.03, 0.13),
            "risk_off": (-0.15, 0.20),
        },
        "mean_reversion": {
            "risk_on": (-0.05, 0.12),
            "neutral": (0.18, 0.10),
            "risk_off": (0.04, 0.16),
        },
        "sentiment_tilt": {
            "risk_on": (0.04, 0.25),
            "neutral": (0.02, 0.25),
            "risk_off": (0.03, 0.28),
        },
    }

    rows = []
    for i in range(n_days):
        d = start + timedelta(days=i)
        k = regimes_seq[i]
        for s, by_regime in profile.items():
            mu_a, vol_a = by_regime[k]
            mu_d = mu_a / 252.0
            vol_d = vol_a / np.sqrt(252.0)
            rows.append(
                {
                    "strategy": s,
                    "as_of": d,
                    "ret": float(rng.normal(mu_d, vol_d)),
                    "regime": k,
                }
            )
    return pd.DataFrame(rows)
