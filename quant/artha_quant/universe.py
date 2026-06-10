"""The asset universe the strategies allocate across.

Deliberately a small, liquid, multi-asset-class set priced in USD. Keeping the
whole universe in one currency sidesteps FX normalization for this phase — a
real cross-currency book would convert every return to a base currency and
decide explicitly whether to hedge FX (see the design notes). We note that here
rather than silently mixing INR and USD returns.

Each asset carries its class so the regime engine and risk overlay can reason
about "risk assets" vs "defensives".
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Asset:
    symbol: str        # Yahoo symbol (works via the v8 chart endpoint)
    label: str
    asset_class: str   # 'equity' | 'fixed_income' | 'commodity' | 'crypto'
    is_risk_asset: bool  # True = risk-on sleeve, False = defensive


# ETF / pair proxies chosen because Yahoo's v8 chart endpoint serves them
# reliably server-side (the same endpoint the existing market cron uses).
UNIVERSE: tuple[Asset, ...] = (
    Asset("SPY", "US Equities (S&P 500)", "equity", True),
    Asset("TLT", "Long Treasuries", "fixed_income", False),
    Asset("GLD", "Gold", "commodity", False),
    Asset("BTC-USD", "Bitcoin", "crypto", True),
)


def symbols() -> list[str]:
    return [a.symbol for a in UNIVERSE]


def risk_assets() -> list[str]:
    return [a.symbol for a in UNIVERSE if a.is_risk_asset]


def defensive_assets() -> list[str]:
    return [a.symbol for a in UNIVERSE if not a.is_risk_asset]


def by_symbol(symbol: str) -> Asset | None:
    for a in UNIVERSE:
        if a.symbol == symbol:
            return a
    return None
