import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchHeadlines, formatTimeAgo } from '../lib/marketData'

const PILLARS = [
  { key: 'markets', label: 'Markets' },
  { key: 'startups', label: 'Startups' },
  { key: 'macro', label: 'Macro' },
]

export default function HeadlinesGrid({ limitPerPillar = 4 }) {
  const [byPillar, setByPillar] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const next = {}
      for (const p of PILLARS) {
        const items = await fetchHeadlines({
          pillar: p.key,
          limit: limitPerPillar,
        })
        if (cancelled) return
        next[p.key] = items
      }
      if (!cancelled) {
        setByPillar(next)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [limitPerPillar])

  // If we have no data at all (cron hasn't run yet), keep this section quiet
  const totalCount = Object.values(byPillar).reduce(
    (n, arr) => n + (arr?.length || 0),
    0
  )
  if (!loading && totalCount === 0) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 'clamp(28px, 4vw, 48px)',
        textAlign: 'left',
      }}
    >
      {PILLARS.map((p, i) => (
        <motion.div
          key={p.key}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, delay: i * 0.08 }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: 'var(--color-oxblood)',
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--color-rule-2)',
            }}
          >
            {p.label}
          </div>

          {loading ? (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-muted-2)',
              }}
            >
              Loading…
            </p>
          ) : byPillar[p.key]?.length ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {byPillar[p.key].map((h, idx) => (
                <li
                  key={h.id || h.url}
                  style={{
                    paddingTop: idx === 0 ? 0 : 14,
                    paddingBottom: 14,
                    borderBottom:
                      idx === byPillar[p.key].length - 1
                        ? 'none'
                        : '1px solid var(--color-rule)',
                  }}
                >
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group"
                    style={{ display: 'block' }}
                  >
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 500,
                        fontSize: 'clamp(15px, 1.6vw, 17px)',
                        lineHeight: 1.35,
                        letterSpacing: '-0.01em',
                        color: 'var(--color-ink)',
                        marginBottom: 6,
                        transition: 'color 0.25s',
                      }}
                      className="group-hover:text-[var(--color-oxblood)]"
                    >
                      {h.title}
                    </h3>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'var(--color-muted-2)',
                      }}
                    >
                      {labelSource(h.source)} ·{' '}
                      {formatTimeAgo(h.published_at || h.fetched_at)}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--color-muted-2)',
              }}
            >
              Quiet
            </p>
          )}
        </motion.div>
      ))}
    </div>
  )
}

function labelSource(s) {
  return (
    {
      mint: 'Mint',
      'mint-economy': 'Mint',
      moneycontrol: 'Moneycontrol',
      'et-markets': 'ET Markets',
      'et-economy': 'ET Economy',
      inc42: 'Inc42',
      yourstory: 'YourStory',
    }[s] || s
  )
}
