// Market data — reads from Supabase (populated daily by /api/cron/market),
// falls back to Yahoo Finance directly if Supabase is unavailable.

import { supabase } from './supabase'

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
  // 1. Try Supabase first — it has the most recent cached snapshot.
  if (supabase) {
    const fromDb = await fetchFromSupabase()
    if (fromDb && fromDb.length > 0) return fromDb
  }
  // 2. Fall back to direct Yahoo fetch.
  return fetchFromYahoo()
}

async function fetchFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('market_quotes')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(50)

    if (error || !data || data.length === 0) return null

    // Pick the latest row per symbol
    const latestBySymbol = new Map()
    for (const row of data) {
      if (!latestBySymbol.has(row.symbol)) {
        latestBySymbol.set(row.symbol, row)
      }
    }

    return SYMBOLS.map((s) => {
      const r = latestBySymbol.get(s.symbol)
      return r
        ? {
            ...s,
            price: Number(r.price),
            change: Number(r.change),
            changePct: Number(r.change_pct),
            currency: r.currency,
            time: r.fetched_at,
          }
        : { ...s, price: null, change: null, changePct: null }
    })
  } catch {
    return null
  }
}

async function fetchFromYahoo() {
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

// ---- Headlines ----

export async function fetchHeadlines({ pillar, limit = 5 } = {}) {
  if (!supabase) return []

  let query = supabase
    .from('headlines')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('fetched_at', { ascending: false })
    .limit(limit)

  if (pillar) query = query.eq('pillar', pillar)

  const { data, error } = await query
  if (error) {
    console.warn('Headlines fetch failed:', error.message)
    return []
  }
  return data || []
}

// ---- Formatters ----

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

export function formatTimeAgo(d) {
  if (!d) return ''
  const date = new Date(d)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
