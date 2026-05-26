// Vercel cron — pulls RSS from a small set of trusted Indian finance/startup
// sources, classifies each item by pillar, dedupes by URL, and writes to
// Supabase. Runs every 30 minutes via vercel.json.
//
// Pillars:
//   markets   — equities, forex, commodities, central bank
//   startups  — funding, founders, product launches, layoffs
//   macro     — policy, GDP, inflation, trade, regulation
//   other     — anything that didn't classify

import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  // Markets
  { url: 'https://www.livemint.com/rss/markets', source: 'mint', pillar: 'markets' },
  { url: 'https://www.moneycontrol.com/rss/marketsnews.xml', source: 'moneycontrol', pillar: 'markets' },
  { url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', source: 'et-markets', pillar: 'markets' },
  // Startups / VC
  { url: 'https://inc42.com/feed/', source: 'inc42', pillar: 'startups' },
  { url: 'https://yourstory.com/feed', source: 'yourstory', pillar: 'startups' },
  // Macro / Economy
  { url: 'https://www.livemint.com/rss/economy', source: 'mint-economy', pillar: 'macro' },
  { url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms', source: 'et-economy', pillar: 'macro' },
]

const KEYWORDS = {
  markets: ['nifty', 'sensex', 'stock', 'equit', 'rupee', 'forex', 'rbi', 'bond', 'commodit', 'gold'],
  startups: ['funding', 'series', 'seed', 'startup', 'founder', 'unicorn', 'venture', 'raise', 'valuation'],
  macro: ['gdp', 'inflation', 'cpi', 'wpi', 'fiscal', 'budget', 'policy', 'tariff', 'trade', 'imf'],
}

function classify(title, defaultPillar) {
  const t = title.toLowerCase()
  for (const [pillar, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => t.includes(w))) return pillar
  }
  return defaultPillar
}

export default async function handler(req, res) {
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

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  })

  const allRows = []
  const errors = []

  for (const feed of FEEDS) {
    try {
      const r = await fetch(feed.url, {
        headers: { 'User-Agent': 'Artha-Insights-Bot/1.0' },
      })
      if (!r.ok) {
        errors.push({ feed: feed.source, status: r.status })
        continue
      }
      const xml = await r.text()
      const parsed = parser.parse(xml)
      const items =
        parsed?.rss?.channel?.item ||
        parsed?.feed?.entry ||
        []

      const list = Array.isArray(items) ? items : [items]

      for (const it of list.slice(0, 15)) {
        const url =
          (typeof it.link === 'string' && it.link) ||
          it.link?.['@_href'] ||
          it.guid?.['#text'] ||
          it.guid

        const title =
          (typeof it.title === 'string' && it.title) ||
          it.title?.['#text']

        if (!url || !title) continue

        const excerpt =
          stripHtml(it.description) ||
          stripHtml(it.summary) ||
          null

        const published =
          parseDate(it.pubDate) || parseDate(it.published) || null

        allRows.push({
          url: String(url).trim(),
          title: String(title).trim(),
          excerpt,
          source: feed.source,
          pillar: classify(title, feed.pillar),
          published_at: published,
        })
      }
    } catch (e) {
      errors.push({ feed: feed.source, error: String(e) })
    }
  }

  if (allRows.length === 0) {
    return res.status(502).json({ error: 'No items pulled', errors })
  }

  // Upsert by URL — duplicates are silently ignored
  const { error } = await supabase
    .from('headlines')
    .upsert(allRows, { onConflict: 'url', ignoreDuplicates: true })

  if (error) {
    return res.status(500).json({ error: error.message, errors })
  }

  return res.status(200).json({ ok: true, count: allRows.length, errors })
}

function stripHtml(s) {
  if (!s) return null
  return String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

function parseDate(s) {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
