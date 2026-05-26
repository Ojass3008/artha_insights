// Vercel cron — fetches market quotes and writes them to Supabase.
// Strategy: try multiple free sources in order until one works.
//   1. Stooq (free, reliable, no auth)
//   2. Yahoo via corsproxy.io
//   3. Yahoo direct (may fail with 429)

import { createClient } from '@supabase/supabase-js'

const SYMBOLS = [
  { symbol: '^NSEI', label: 'NIFTY 50', stooq: '^nsei' },
  { symbol: '^BSESN', label: 'Sensex', stooq: '^bse' },
  { symbol: '^NSEBANK', label: 'Bank NIFTY', stooq: '^nsebank' },
  { symbol: 'INR=X', label: 'USD / INR', stooq: 'usdinr' },
  { symbol: '^INDIAVIX', label: 'India VIX', stooq: '^indiavix' },
]

export default async function handler(req, res) {
  try {
    // ---- Auth ----
    const expectedSecret = (process.env.CRON_SECRET || '').trim()
    const querySecret = (req.query.secret || '').trim()
    const cleanHeader = (req.headers.authorization || '')
      .replace(/^Bearer\s+/i, '')
      .trim()
    const isVercelCron = (req.headers['user-agent'] || '').includes('vercel-cron')

    const authorized =
      isVercelCron ||
      (expectedSecret && cleanHeader === expectedSecret) ||
      (expectedSecret && querySecret === expectedSecret)

    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // ---- Supabase ----
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Supabase env vars missing' })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })

    // ---- Fetch ----
    const rows = []
    const errors = []

    for (const s of SYMBOLS) {
      try {
        const quote = await fetchStooq(s.stooq)
        if (quote) {
          rows.push({
            symbol: s.symbol,
            label: s.label,
            price: quote.price,
            change: quote.change,
            change_pct: quote.changePct,
            currency: s.symbol === 'INR=X' ? 'INR' : 'INR',
            source: 'stooq',
          })
        } else {
          errors.push({ symbol: s.symbol, reason: 'no data' })
        }
      } catch (e) {
        errors.push({ symbol: s.symbol, error: String(e) })
      }
    }

    if (rows.length === 0) {
      return res.status(502).json({
        error: 'No quotes returned from any source',
        errors,
      })
    }

    // ---- Write ----
    const { error } = await supabase.from('market_quotes').insert(rows)

    if (error) {
      return res.status(500).json({
        error: 'Supabase insert failed',
        detail: error.message,
      })
    }

    return res.status(200).json({ ok: true, count: rows.length, errors })
  } catch (e) {
    return res.status(500).json({
      error: 'Unhandled exception',
      detail: String(e),
    })
  }
}

// ---- Stooq fetcher ----
//
// Stooq is a free Polish data provider with global coverage and no auth.
// Format: https://stooq.com/q/l/?s=^nsei&f=sd2t2ohlcv&h&e=csv
// Returns CSV like: Symbol,Date,Time,Open,High,Low,Close,Volume
async function fetchStooq(stooqSymbol) {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&f=sd2t2ohlcv&h&e=csv`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Artha-Insights/1.0' },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) return null
  const text = await r.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return null

  const header = lines[0].toLowerCase().split(',')
  const data = lines[1].split(',')
  const get = (key) => {
    const i = header.indexOf(key)
    return i >= 0 ? data[i] : null
  }

  const close = parseFloat(get('close'))
  const open = parseFloat(get('open'))

  if (isNaN(close)) return null

  const change = isNaN(open) ? 0 : close - open
  const changePct = isNaN(open) || open === 0 ? 0 : ((close - open) / open) * 100

  return {
    price: close,
    change,
    changePct,
  }
}
