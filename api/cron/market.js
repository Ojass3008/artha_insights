// Vercel cron — fetches market quotes via Yahoo's v8 chart endpoint
// (which works server-side, unlike v7/quote which throttles aggressively)
// and writes them to Supabase.

import { createClient } from '@supabase/supabase-js'

const SYMBOLS = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'Sensex' },
  { symbol: '^NSEBANK', label: 'Bank NIFTY' },
  { symbol: 'INR=X', label: 'USD / INR' },
  { symbol: '^INDIAVIX', label: 'India VIX' },
]

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/'

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

    // ---- Fetch each symbol in parallel ----
    const results = await Promise.allSettled(
      SYMBOLS.map((s) => fetchYahooChart(s.symbol).then((q) => ({ s, q })))
    )

    const rows = []
    const errors = []

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.q) {
        const { s, q } = r.value
        rows.push({
          symbol: s.symbol,
          label: s.label,
          price: q.price,
          change: q.change,
          change_pct: q.changePct,
          currency: q.currency,
          source: 'yahoo-v8',
        })
      } else if (r.status === 'fulfilled') {
        errors.push({ symbol: r.value.s.symbol, reason: 'no data' })
      } else {
        errors.push({ reason: String(r.reason) })
      }
    }

    if (rows.length === 0) {
      return res.status(502).json({
        error: 'No quotes returned',
        errors,
      })
    }

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

// Yahoo's v8 chart endpoint: returns OHLC + meta with regularMarketPrice
async function fetchYahooChart(symbol) {
  const url = `${CHART_BASE}${encodeURIComponent(symbol)}?interval=1d&range=2d`
  const r = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) return null
  const json = await r.json()
  const meta = json?.chart?.result?.[0]?.meta
  if (!meta) return null

  const price = meta.regularMarketPrice
  const previous = meta.chartPreviousClose ?? meta.previousClose
  if (typeof price !== 'number') return null

  const change = previous != null ? price - previous : 0
  const changePct = previous ? (change / previous) * 100 : 0

  return {
    price,
    change,
    changePct,
    currency: meta.currency || null,
  }
}
