import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchMarketSnapshot, formatNumber, formatPct } from '../lib/marketData'

export default function PulseStrip({ compact = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const snapshot = await fetchMarketSnapshot()
        if (!cancelled) setData(snapshot)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    load()

    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (error) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}
      >
        Pulse · offline
      </div>
    )
  }

  if (!data) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-muted-2)',
        }}
      >
        Loading pulse…
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="grid"
      style={{
        gridTemplateColumns: compact
          ? 'repeat(auto-fit, minmax(140px, 1fr))'
          : 'repeat(auto-fit, minmax(160px, 1fr))',
        columnGap: 'clamp(20px, 4vw, 56px)',
        rowGap: 'clamp(28px, 5vw, 48px)',
        borderTop: compact ? 'none' : '1px solid var(--color-rule)',
        paddingTop: compact ? 0 : 'clamp(28px, 5vw, 48px)',
        textAlign: 'left',
      }}
    >
      {data.map((item) => (
        <Quote key={item.symbol} item={item} />
      ))}
    </motion.div>
  )
}

function Quote({ item }) {
  const up = item.change >= 0
  const accent = up ? 'var(--color-ink)' : 'var(--color-oxblood)'

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          marginBottom: 8,
        }}
      >
        {item.label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(22px, 3.4vw, 28px)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {formatNumber(item.price, { decimals: 2 })}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.02em',
          color: accent,
        }}
      >
        {up ? '▲' : '▼'} {formatPct(item.changePct)}
      </div>
    </div>
  )
}
