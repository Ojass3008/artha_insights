// Free market data via Yahoo Finance.
// We use a CORS-friendly proxy (query1.finance.yahoo.com supports it through
// allorigins.win for client-side fetching).
//
// Symbols:
//   ^NSEI    — NIFTY 50
//   ^BSESN   — BSE Sensex
//   ^NSMIDCP — NIFTY Midcap 100
//   INR=X    — USD/INR
//   ^INDIAVIX — India VIX
//   GC=F     — Gold futures (USD/oz)

const SYMBOLS = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'Sensex' },
  { symbol: '^NSEBANK', label: 'Bank NIFTY' },
  { symbol: 'INR=X', label: 'USD / INR' },
  { symbol: '^INDIAVIX', label: 'India VIX' },
]

const PROXY = 'https://api.allorigins.win/raw?url='
const YAHOO = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols='

export async function fetchMarketSnapshot() {
  const url = `${PROXY}${encodeURIComponent(
    YAHOO + SYMBOLS.map((s) => s.symbol).join(',')
  )}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch market data')
  const json = await res.json()
  const quotes = json?.quoteResponse?.result ?? []

  return SYMBOLS.map((s) => {
    const q = quotes.find((x) => x.symbol === s.symbol)
    if (!q) return { ...s, price: null, change: null, changePct: null }
    return {
      ...s,
      price: q.regularMarketPrice,
      change: q.regularMarketChange,
      changePct: q.regularMarketChangePercent,
      time: q.regularMarketTime,
      currency: q.currency,
    }
  })
}

export function formatNumber(n, opts = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: opts.decimals ?? 2,
    maximumFractionDigits: opts.decimals ?? 2,
  }).format(n)
}

export function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
