// Vercel cron — fetches market quotes from Yahoo Finance and writes them
// to Supabase. Runs every 15 minutes via vercel.json.
//
// Symbols covered:
//   ^NSEI     — NIFTY 50
//   ^BSESN    — Sensex
//   ^NSEBANK  — Bank NIFTY
//   INR=X     — USD/INR
//   ^INDIAVIX — India VIX

import { createClient } from '@supabase/supabase-js'

const SYMBOLS = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'Sensex' },
  { symbol: '^NSEBANK', label: 'Bank NIFTY' },
  { symbol: 'INR=X', label: 'USD / INR' },
  { symbol: '^INDIAVIX', label: 'India VIX' },
]

const YAHOO_BASE =
  'https://query1.finance.yahoo.com/v7/finance/quote?symbols='

export default async function handler(req, res) {
  // Vercel cron sends a special header; reject unauthorized callers in prod.
  if (
    process.env.NODE_ENV === 'production' &&
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars missing' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  try {
    const url = `${YAHOO_BASE}${SYMBOLS.map((s) => s.symbol).join(',')}`
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!r.ok) {
      return res
        .status(502)
        .json({ error: 'Yahoo fetch failed', status: r.status })
    }

    const json = await r.json()
    const quotes = json?.quoteResponse?.result ?? []

    const rows = SYMBOLS.map((s) => {
      const q = quotes.find((x) => x.symbol === s.symbol)
      return q
        ? {
            symbol: s.symbol,
            label: s.label,
            price: q.regularMarketPrice ?? null,
            change: q.regularMarketChange ?? null,
            change_pct: q.regularMarketChangePercent ?? null,
            currency: q.currency ?? null,
            source: 'yahoo',
          }
        : null
    }).filter(Boolean)

    if (rows.length === 0) {
      return res.status(502).json({ error: 'No quotes returned' })
    }

    const { error } = await supabase.from('market_quotes').insert(rows)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true, count: rows.length })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
