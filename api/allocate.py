"""On-demand meta-allocator API — runs the pipeline live and returns JSON.

This is the interactive counterpart to api/cron/allocate.py:
  - the CRON job runs on a schedule and always persists;
  - THIS endpoint is called by the dashboard's "Run live analysis" button,
    recomputes from fresh market prices, returns the full decision as JSON, and
    (best-effort) persists so the cached view stays in sync.

Security note: this endpoint runs real compute (numpy/pandas + a market data
fetch) on each call. To prevent abuse you can set ALLOCATE_API_TOKEN in the
environment — when set, callers must pass it via ?token= or an Authorization
header. If it is unset the endpoint is open (fine for low-traffic/personal use,
but flagged intentionally). Persistence always uses the server-side service-role
key and is never exposed to the browser.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

# Make the bundled quant package importable.
_HERE = os.path.dirname(os.path.abspath(__file__))
_QUANT = os.path.abspath(os.path.join(_HERE, "..", "quant"))
if _QUANT not in sys.path:
    sys.path.insert(0, _QUANT)


def _authorized(headers, query) -> bool:
    """Open unless ALLOCATE_API_TOKEN is configured, then require it."""
    token = (os.environ.get("ALLOCATE_API_TOKEN") or "").strip()
    if not token:
        return True  # no token configured -> public
    header_token = (headers.get("authorization") or "")
    header_token = header_token.replace("Bearer ", "").replace("bearer ", "").strip()
    query_token = (query.get("token", [""])[0] or "").strip()
    return header_token == token or query_token == token


def _decision_to_json(d) -> dict:
    """Serialize a MetaDecision into the shape the dashboard consumes."""
    conf = d.confidence
    return {
        "ok": True,
        "as_of": str(d.as_of),
        "active_regime": d.active_regime,
        "regime_probs": {k: round(float(v), 4) for k, v in d.regime_probs.items()},
        "confidence": {
            "c_raw": round(float(conf.c_raw), 4),
            "c_effective": round(float(conf.c_effective), 4),
            "anchor_blend": round(float(conf.anchor_blend), 4),
            "regime_entropy": round(float(conf.regime_entropy), 4),
        },
        "strategies": [
            {
                "strategy": s,
                "weight_learned": round(float(d.weights_learned.get(s, 0.0)), 4),
                "weight_final": round(float(d.weights_final.get(s, 0.0)), 4),
                "reliability": round(float(d.reliability.get(s, 0.0)), 4),
                "lcb_sharpe": round(float(d.lcb_sharpe.get(s, 0.0)), 4),
                "is_anchor": s == _anchor_of(d),
            }
            for s in d.strategies
        ],
        "reasoning": d.reasoning,
    }


def _anchor_of(d) -> str:
    # In anchor-only mode the anchor holds ~all final weight; otherwise fall
    # back to the configured default name used across the package.
    from artha_quant.config import DEFAULT_CONFIG

    return DEFAULT_CONFIG.anchor_strategy


def _run() -> dict:
    from artha_quant.config import Config
    from artha_quant.pipeline import run_pipeline
    from artha_quant.store import SupabaseStore

    cfg = Config()  # anchor-only by default
    run = run_pipeline(cfg, allow_network=True)
    payload = _decision_to_json(run.decision)

    # Best-effort persist so the cached dashboard view stays fresh. Failures
    # here must not break the live response.
    try:
        store = SupabaseStore()
        if store.available:
            store.persist_ledger(run.backtest.ledger)
            store.persist_decision(run.decision)
            payload["persisted"] = True
        else:
            payload["persisted"] = False
    except Exception:
        payload["persisted"] = False

    return payload


class handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        headers = {k.lower(): v for k, v in self.headers.items()}

        if not _authorized(headers, query):
            return self._send(401, {"ok": False, "error": "Unauthorized"})

        try:
            return self._send(200, _run())
        except Exception as e:
            return self._send(500, {"ok": False, "error": str(e)})

    def _send(self, code: int, body: dict):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        # Allow the browser to call it; same-origin in production anyway.
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
