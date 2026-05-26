// Vercel cron — fetches market quotes from Yahoo Finance and writes them
// to Supabase. Runs daily via vercel.json.

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
  try {
    // Auth — accept Vercel cron, header secret, or query secret
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
      return res.status(401).json({
        error: 'Unauthorized',
        hint: expectedSecret
          ? 'secret mismatch'
          : 'CRON_SECRET env var not set',
      })
    }

    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error: 'Supabase env vars missing',
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SERVICE_KEY,
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })

    const symbolStr = SYMBOLS.map((s) => s.symbol).join(',')
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      YAHOO_BASE + symbolStr
    )}`

    let yahooRes
    try {
      yahooRes = await fetch(proxyUrl)
    } catch (e) {
      return res.status(502).json({
        error: 'Yahoo fetch threw',
        detail: String(e),
      })
    }

    if (!yahooRes.ok) {
      return res.status(502).json({
        error: 'Yahoo fetch not OK',
        status: yahooRes.status,
      })
    }

    let json
    try {
      json = await yahooRes.json()
    } catch (e) {
      return res.status(502).json({
        error: 'Yahoo response not JSON',
        detail: String(e),
      })
    }

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
      return res.status(502).json({
        error: 'No quotes returned',
        receivedCount: quotes.length,
      })
    }

    const { error } = await supabase.from('market_quotes').insert(rows)

    if (error) {
      return res.status(500).json({
        error: 'Supabase insert failed',
        detail: error.message,
      })
    }

    return res.status(200).json({ ok: true, count: rows.length })
  } catch (e) {
    return res.status(500).json({
      error: 'Unhandled exception',
      detail: String(e),
      stack: e?.stack?.split('\n').slice(0, 3),
    })
  }
}
