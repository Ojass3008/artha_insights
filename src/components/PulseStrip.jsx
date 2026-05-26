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

    // refresh every 5 minutes while page is open
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (error) {
    return (
      <div
        className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-muted)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        Pulse · offline
      </div>
    )
  }

  if (!data) {
    return (
      <div
        className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-muted-2)]"
        style={{ fontFamily: 'var(--font-mono)' }}
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
      className={`grid ${
        compact
          ? 'grid-cols-2 md:grid-cols-5 gap-x-10 gap-y-8'
          : 'grid-cols-2 md:grid-cols-5 gap-x-14 gap-y-12 border-t border-[var(--color-rule)] pt-12'
      }`}
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
        className="text-[10px] tracking-[0.24em] uppercase text-[var(--color-muted)] mb-2"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {item.label}
      </div>
      <div
        className="text-[24px] md:text-[28px] tracking-tight leading-none mb-1"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
      >
        {formatNumber(item.price, { decimals: item.symbol === 'INR=X' ? 2 : 2 })}
      </div>
      <div
        className="text-[11px] tracking-wide"
        style={{ fontFamily: 'var(--font-mono)', color: accent }}
      >
        {up ? '▲' : '▼'} {formatPct(item.changePct)}
      </div>
    </div>
  )
}
