"""Supabase persistence for meta-allocator decisions.

Degrades gracefully: if the `supabase` package or credentials are absent, the
store becomes a no-op and the rest of the pipeline still runs (useful for the
synthetic demo and for tests). Writes use the service-role key and so bypass
RLS — never expose that key to the browser.

Env vars (matching the project's existing convention in api/cron/market.js):
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

import pandas as pd

from .meta_allocator import MetaDecision

# Supabase rejects very large single inserts; chunk the ledger upsert.
_LEDGER_CHUNK = 500


def _load_dotenv() -> None:
    """Best-effort load of a .env file next to the package (quant/.env).

    No external dependency needed — just reads KEY=VALUE lines and sets them
    in os.environ if not already set (existing env vars take precedence).
    """
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


# Load on import so credentials are available before _get_client() runs.
_load_dotenv()


def _get_client():
    """Return a Supabase client, or None if unavailable/unconfigured."""
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    try:
        from supabase import create_client  # imported lazily
    except ImportError:
        return None
    try:
        return create_client(url, key)
    except Exception:
        return None


class SupabaseStore:
    """Thin wrapper around the Supabase tables in meta_schema.sql."""

    def __init__(self, client=None) -> None:
        self.client = client if client is not None else _get_client()

    @property
    def available(self) -> bool:
        return self.client is not None

    # ---- reads -------------------------------------------------------------

    def load_ledger(self, limit: int = 100_000) -> pd.DataFrame:
        """Load the strategy_returns ledger into the long-format DataFrame."""
        if not self.available:
            return _empty_ledger()
        res = (
            self.client.table("strategy_returns")
            .select("strategy, as_of, ret, regime")
            .order("as_of", desc=False)
            .limit(limit)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return _empty_ledger()
        df = pd.DataFrame(rows)
        df["as_of"] = pd.to_datetime(df["as_of"]).dt.date
        df["ret"] = pd.to_numeric(df["ret"], errors="coerce")
        return df.dropna(subset=["ret"])

    # ---- writes ------------------------------------------------------------

    def persist_ledger(self, ledger: pd.DataFrame) -> int:
        """Upsert strategy_returns rows. Returns the number of rows written.

        Idempotent via the (strategy, as_of) unique constraint, so re-running
        the ingest job overwrites rather than duplicating. regime_probs is
        stored as JSON for the explainability layer.
        """
        if not self.available or ledger.empty:
            return 0

        records = []
        for _, r in ledger.iterrows():
            as_of = r["as_of"]
            records.append(
                {
                    "strategy": str(r["strategy"]),
                    "as_of": as_of.isoformat() if hasattr(as_of, "isoformat") else str(as_of),
                    "ret": float(r["ret"]),
                    "regime": str(r["regime"]),
                    "regime_probs": json.dumps(r.get("regime_probs"))
                    if r.get("regime_probs") is not None
                    else None,
                }
            )

        written = 0
        for i in range(0, len(records), _LEDGER_CHUNK):
            chunk = records[i : i + _LEDGER_CHUNK]
            self.client.table("strategy_returns").upsert(
                chunk, on_conflict="strategy,as_of"
            ).execute()
            written += len(chunk)
        return written

    def persist_decision(self, d: MetaDecision) -> bool:
        """Upsert meta_weights rows + the confidence_log row for one decision."""
        if not self.available:
            return False

        as_of = d.as_of.isoformat()

        weight_rows = [
            {
                "as_of": as_of,
                "strategy": s,
                "weight_learned": float(d.weights_learned.get(s, 0.0)),
                "weight_final": float(d.weights_final.get(s, 0.0)),
                "reliability": float(d.reliability.get(s, 0.0)),
                "lcb_sharpe": float(d.lcb_sharpe.get(s, 0.0)),
                "is_anchor": s == self._anchor_name(d),
            }
            for s in d.strategies
        ]
        self.client.table("meta_weights").upsert(
            weight_rows, on_conflict="as_of,strategy"
        ).execute()

        conf = d.confidence
        self.client.table("confidence_log").upsert(
            {
                "as_of": as_of,
                "c_raw": float(conf.c_raw),
                "c_effective": float(conf.c_effective),
                "anchor_blend": float(conf.anchor_blend),
                "confidence_ceiling": float(conf.c_effective)
                if conf.c_effective > 0
                else 0.0,
                "regime_entropy": float(conf.regime_entropy),
                "strategy_dispersion": float(conf.strategy_dispersion),
                "mean_reliability": float(conf.mean_reliability),
                "active_regime": d.active_regime,
                "regime_probs": json.dumps(d.regime_probs),
                "notes": d.reasoning,
            },
            on_conflict="as_of",
        ).execute()
        return True

    @staticmethod
    def _anchor_name(d: MetaDecision) -> str:
        # The anchor is the strategy that holds all weight when c=0.
        # Recoverable from weights_final in anchor-only mode; default safe.
        ranked = sorted(d.weights_final.items(), key=lambda kv: kv[1], reverse=True)
        return ranked[0][0] if ranked else ""


def _empty_ledger() -> pd.DataFrame:
    return pd.DataFrame(columns=["strategy", "as_of", "ret", "regime"])
