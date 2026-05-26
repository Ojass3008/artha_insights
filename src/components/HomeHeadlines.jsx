import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { fetchHeadlines, formatTimeAgo } from '../lib/marketData'

/**
 * HomeHeadlines
 * --------------
 * A quiet single row of 3 headlines surfacing what's moving today.
 * Used as a small interstitial scene between Pulse and the Brief.
 * Keeps the cinematic feel by being restrained — no images, no logos.
 */
export default function HomeHeadlines() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const all = await fetchHeadlines({ limit: 3 })
      if (!cancelled) setItems(all)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!items || items.length === 0) return null

  return (
    <div style={{ width: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="eyebrow" style={{ marginBottom: 16 }}>
          What's moving
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(28px, 4.5vw, 56px)',
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            maxWidth: '18ch',
            margin: '0 auto 56px',
          }}
        >
          The day's <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>narrative.</span>
        </h2>

        <ul
          style={{
            listStyle: 'none',
            margin: '0 auto',
            padding: 0,
            maxWidth: 760,
            textAlign: 'left',
          }}
        >
          {items.map((h, i) => (
            <motion.li
              key={h.id || h.url}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.7,
                delay: 0.1 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                borderTop: i === 0 ? '1px solid var(--color-rule-2)' : '1px solid var(--color-rule)',
                borderBottom: i === items.length - 1 ? '1px solid var(--color-rule-2)' : 'none',
              }}
            >
              <a
                href={h.url}
                target="_blank"
                rel="noreferrer"
                className="group"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '20px 4px',
                  transition: 'opacity 0.3s',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.32em',
                    textTransform: 'uppercase',
                    color: 'var(--color-oxblood)',
                  }}
                >
                  {labelPillar(h.pillar)} · {labelSource(h.source)} · {formatTimeAgo(h.published_at || h.fetched_at)}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 'clamp(17px, 2vw, 22px)',
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    color: 'var(--color-ink)',
                    transition: 'color 0.25s',
                  }}
                  className="group-hover:text-[var(--color-oxblood)]"
                >
                  {h.title}
                </h3>
              </a>
            </motion.li>
          ))}
        </ul>

        <div style={{ marginTop: 32 }}>
          <Link
            to="/today"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              transition: 'color 0.25s',
            }}
            className="hover:text-[var(--color-oxblood)]"
          >
            Full snapshot →
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

function labelPillar(p) {
  return (
    {
      markets: 'Markets',
      startups: 'Startups',
      macro: 'Macro',
      other: 'Watch',
    }[p] || 'Watch'
  )
}

function labelSource(s) {
  return (
    {
      mint: 'Mint',
      'mint-economy': 'Mint',
      moneycontrol: 'Moneycontrol',
      'et-markets': 'ET',
      'et-economy': 'ET',
      inc42: 'Inc42',
      yourstory: 'YourStory',
    }[s] || s
  )
}
