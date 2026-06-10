"""Price-history data layer for the strategy engine.

Two sources, mirroring the project's existing pattern in api/cron/market.js:
  1. Yahoo's v8 chart endpoint (works server-side, unlike v7/quote).
  2. A deterministic synthetic generator for offline use, tests, and the demo.

Everything downstream consumes a single clean artefact: a wide DataFrame of
daily ADJUSTED-CLOSE prices indexed by date, one column per symbol, calendars
aligned and forward-filled (never backward — that would leak the future).

The normalization discipline (log returns, vol-scaling) lives in signals.py;
this module's only job is to produce trustworthy point-in-time prices.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from .universe import UNIVERSE, symbols

CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36",
    "Accept": "application/json",
}


def load_prices(
    lookback_days: int = 800,
    *,
    allow_network: bool = True,
    seed: int = 11,
) -> pd.DataFrame:
    """Return a wide daily-price DataFrame for the universe.

    Tries Yahoo first (if allow_network); falls back to synthetic data so the
    pipeline, tests, and demo always have something to run on. The fallback is
    deterministic given `seed`.
    """
    if allow_network:
        try:
            df = _load_from_yahoo(lookback_days)
            if df is not None and not df.empty and df.shape[1] == len(UNIVERSE):
                return _clean(df)
        except Exception:
            pass  # fall through to synthetic
    return _synthetic_prices(lookback_days, seed=seed)


# ---- Yahoo ----------------------------------------------------------------


def _load_from_yahoo(lookback_days: int) -> pd.DataFrame | None:
    import urllib.request
    import json

    rng = f"{max(lookback_days + 30, 60)}d"
    series: dict[str, pd.Series] = {}

    for sym in symbols():
        url = f"{CHART_BASE}{sym}?interval=1d&range={rng}"
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        result = payload.get("chart", {}).get("result")
        if not result:
            return None
        r0 = result[0]
        ts = r0.get("timestamp")
        quote = r0.get("indicators", {}).get("quote", [{}])[0]
        closes = quote.get("close")
        # Prefer adjusted close when present (handles dividends/splits).
        adj = (
            r0.get("indicators", {})
            .get("adjclose", [{}])[0]
            .get("adjclose")
        )
        values = adj if adj else closes
        if not ts or not values:
            return None
        idx = pd.to_datetime([pd.Timestamp(t, unit="s").date() for t in ts])
        series[sym] = pd.Series(values, index=idx, dtype="float64")

    df = pd.DataFrame(series).sort_index()
    return df


# ---- cleaning -------------------------------------------------------------


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    """Align calendars and forward-fill only (no lookahead)."""
    df = df.sort_index()
    # Union of all dates, forward-fill gaps (e.g. crypto trades weekends but
    # equities don't). Forward-fill is point-in-time safe; bfill is NOT.
    df = df.asfreq("D").ffill()
    # Drop leading rows that are still NaN (before an asset had any price).
    df = df.dropna(how="any")
    return df


# ---- synthetic fallback ---------------------------------------------------


def _synthetic_prices(lookback_days: int, *, seed: int) -> pd.DataFrame:
    """Deterministic multi-asset price paths with embedded regime shifts.

    Built so the regime engine and strategies have something realistic to bite
    on: trending risk-on stretches, choppy ranges, and a drawdown/crisis. Not a
    forecast — just structured noise with the right qualitative behaviour.
    """
    rng = np.random.default_rng(seed)
    n = lookback_days
    start = date.today() - timedelta(days=n)
    idx = pd.to_datetime([start + timedelta(days=i) for i in range(n)])

    # A hidden regime path: 0 risk_on, 1 neutral, 2 risk_off/crisis.
    regime = np.zeros(n, dtype=int)
    k = 0
    i = 0
    while i < n:
        dwell = int(rng.integers(25, 70))
        regime[i : i + dwell] = k
        i += dwell
        k = int(rng.choice([0, 1, 2], p=[0.45, 0.4, 0.15]))

    # (drift, vol) per (asset, regime) — annualized.
    profiles = {
        "SPY": {0: (0.16, 0.12), 1: (0.04, 0.13), 2: (-0.25, 0.30)},
        "TLT": {0: (0.01, 0.10), 1: (0.03, 0.10), 2: (0.10, 0.14)},  # flight-to-safety
        "GLD": {0: (0.05, 0.13), 1: (0.04, 0.12), 2: (0.12, 0.18)},
        "BTC-USD": {0: (0.60, 0.55), 1: (0.05, 0.60), 2: (-0.50, 0.95)},
    }

    out: dict[str, np.ndarray] = {}
    for sym, prof in profiles.items():
        logret = np.empty(n)
        for t in range(n):
            mu_a, vol_a = prof[regime[t]]
            mu_d = mu_a / 252.0 - 0.5 * (vol_a**2) / 252.0
            vol_d = vol_a / np.sqrt(252.0)
            logret[t] = rng.normal(mu_d, vol_d)
        price = 100.0 * np.exp(np.cumsum(logret))
        out[sym] = price

    return pd.DataFrame(out, index=idx)
