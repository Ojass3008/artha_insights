"""Vercel cron — runs the meta-allocator pipeline and writes to Supabase.

Mirrors the auth pattern of api/cron/market.js (CRON_SECRET header/query, or the
vercel-cron user-agent). On each run it:
  1. loads multi-asset prices (Yahoo v8, with a synthetic fallback),
  2. builds the point-in-time strategy-return ledger (the mini-backtester),
  3. computes the meta-allocator decision (anchor-only by default), and
  4. upserts strategy_returns, meta_weights and confidence_log.

The heavy lifting lives in the `quant/` package; this file is a thin,
serverless-friendly wrapper. The `quant/` tree is bundled into the function via
the `includeFiles` setting in vercel.json.

Safety: the pipeline ships anchor-only (confidence_ceiling = 0.0), so this job
can run in production and will only ever persist a pure risk-parity allocation
until that ceiling is deliberately raised in quant/artha_quant/config.py.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

# Make the quant package importable. The quant/ directory is bundled alongside
# this function (see vercel.json -> functions.includeFiles).
_HERE = os.path.dirname(os.path.abspath(__file__))
_QUANT = os.path.abspath(os.path.join(_HERE, "..", "..", "quant"))
if _QUANT not in sys.path:
    sys.path.insert(0, _QUANT)


def _authorized(headers, query) -> bool:
    expected = (os.environ.get("CRON_SECRET") or "").strip()
    ua = (headers.get("user-agent") or "").lower()
    if "vercel-cron" in ua:
        return True
    if not expected:
        # No secret configured: allow vercel-cron only (handled above).
        return False
    header_secret = (headers.get("authorization") or "")
    header_secret = header_secret.replace("Bearer ", "").replace("bearer ", "").strip()
    query_secret = (query.get("secret", [""])[0] or "").strip()
    return header_secret == expected or query_secret == expected


def _run() -> dict:
    """Execute the pipeline and persist. Returns a JSON-able summary."""
    from artha_quant.config import Config
    from artha_quant.pipeline import run_pipeline
    from artha_quant.store import SupabaseStore

    cfg = Config()  # anchor-only by default
    run = run_pipeline(cfg, allow_network=True)
    d = run.decision

    store = SupabaseStore()
    persisted = False
    ledger_rows = 0
    if store.available:
        ledger_rows = store.persist_ledger(run.backtest.ledger)
        persisted = store.persist_decision(d)

    return {
        "ok": True,
        "as_of": str(d.as_of),
        "active_regime": d.active_regime,
        "confidence_effective": round(d.confidence.c_effective, 4),
        "anchor_blend": round(d.confidence.anchor_blend, 4),
        "weights_final": {k: round(v, 4) for k, v in d.weights_final.items()},
        "ledger_rows_written": ledger_rows,
        "decision_persisted": persisted,
        "supabase_configured": store.available,
        "reasoning": d.reasoning,
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 (Vercel/BaseHTTPRequestHandler convention)
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        headers = {k.lower(): v for k, v in self.headers.items()}

        if not _authorized(headers, query):
            return self._send(401, {"error": "Unauthorized"})

        try:
            result = _run()
            return self._send(200, result)
        except Exception as e:  # surface the failure, don't 200-swallow it
            return self._send(500, {"error": "pipeline failed", "detail": str(e)})

    def _send(self, code: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
