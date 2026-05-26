import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import PulseStrip from '../components/PulseStrip'
import PageWrap from '../components/PageWrap'
import {
  fetchMarketSnapshot,
  formatNumber,
  formatPct,
} from '../lib/marketData'

export default function Today() {
  const [snapshot, setSnapshot] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const d = await fetchMarketSnapshot()
        if (!cancelled) {
          setSnapshot(d)
          setUpdatedAt(new Date())
        }
      } catch {
        /* handled in PulseStrip */
      }
    }
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <PageWrap maxWidth={860}>
      {/* HEADER */}
      <div className="eyebrow mb-5">Today</div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(36px, 6vw, 68px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          maxWidth: '16ch',
          margin: '0 auto 32px',
        }}
      >
        The daily{' '}
        <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>
          economic snapshot.
        </span>
      </h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          marginBottom: 80,
        }}
      >
        <span>{longToday()}</span>
        {updatedAt && (
          <>
            <span
              style={{
                display: 'inline-block',
                width: 24,
                height: 1,
                background: 'var(--color-rule-2)',
              }}
            />
            <span>
              Updated{' '}
              {updatedAt.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              IST
            </span>
          </>
        )}
      </div>

      {/* PULSE */}
      <SectionLabel>Markets</SectionLabel>
      <PulseStrip />
      <Spacer />

      {/* DETAIL TABLE */}
      {snapshot && (
        <>
          <SectionLabel>Detail</SectionLabel>
          <DetailTable rows={snapshot} />
          <Spacer />
        </>
      )}

      {/* THE READ */}
      <SectionLabel>The reading</SectionLabel>

      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(24px, 3.2vw, 34px)',
          lineHeight: 1.2,
          letterSpacing: '-0.015em',
          maxWidth: '22ch',
          margin: '0 auto 32px',
        }}
      >
        What the numbers say, in one paragraph.
      </h2>

      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(17px, 1.7vw, 20px)',
          lineHeight: 1.7,
          color: 'var(--color-ink-2)',
          maxWidth: '52ch',
          margin: '0 auto',
        }}
      >
        {snapshot ? readNumbers(snapshot) : 'Loading the read…'}
      </p>

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          fontStyle: 'italic',
          color: 'var(--color-muted)',
          maxWidth: '52ch',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Auto-generated from end-of-day prices. The proper read lands in
        Sunday's Brief.
      </p>

      <p
        style={{
          marginTop: 96,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'var(--color-muted-2)',
        }}
      >
        Editorial only · Not investment advice
      </p>
    </PageWrap>
  )
}

/* ---------------- helpers ---------------- */

function Spacer() {
  return <div style={{ height: 96 }} />
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 32,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          flexShrink: 0,
        }}
      >
        {children}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: 'var(--color-rule)',
        }}
      />
    </div>
  )
}

function DetailTable({ rows }) {
  return (
    <div style={{ borderTop: '1px solid var(--color-rule-2)' }}>
      {rows.map((r, i) => (
        <motion.div
          key={r.symbol}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr 0.8fr 0.8fr',
            gap: 16,
            alignItems: 'baseline',
            padding: '20px 0',
            borderBottom: '1px solid var(--color-rule)',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            {r.label}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              textAlign: 'right',
            }}
          >
            {formatNumber(r.price, { decimals: 2 })}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              textAlign: 'right',
              color:
                r.change >= 0 ? 'var(--color-ink-2)' : 'var(--color-oxblood)',
            }}
          >
            {r.change !== null && r.change !== undefined
              ? (r.change >= 0 ? '+' : '') + r.change.toFixed(2)
              : '—'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              textAlign: 'right',
              color:
                r.changePct >= 0 ? 'var(--color-ink-2)' : 'var(--color-oxblood)',
            }}
          >
            {formatPct(r.changePct)}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/* ---------------- algorithmic read ---------------- */

function readNumbers(rows) {
  const nifty = rows.find((r) => r.symbol === '^NSEI')
  const sensex = rows.find((r) => r.symbol === '^BSESN')
  const inr = rows.find((r) => r.symbol === 'INR=X')
  const vix = rows.find((r) => r.symbol === '^INDIAVIX')

  if (!nifty || !sensex) return 'Loading the read…'

  const niftyDir = nifty.changePct >= 0 ? 'higher' : 'lower'
  const sensexAgrees =
    Math.sign(nifty.changePct) === Math.sign(sensex.changePct)
  const inrPart =
    inr && inr.changePct
      ? inr.changePct > 0
        ? 'the rupee softened against the dollar'
        : 'the rupee firmed against the dollar'
      : null
  const vixPart =
    vix && vix.changePct
      ? vix.changePct > 5
        ? 'and volatility expanded'
        : vix.changePct < -5
          ? 'while volatility eased'
          : null
      : null

  const parts = [
    `Indian benchmarks closed ${niftyDir}, with NIFTY at ${formatNumber(nifty.price, { decimals: 2 })} (${formatPct(nifty.changePct)})`,
    sensexAgrees
      ? `and Sensex following at ${formatNumber(sensex.price, { decimals: 2 })} (${formatPct(sensex.changePct)})`
      : `while Sensex moved counter to NIFTY at ${formatNumber(sensex.price, { decimals: 2 })} (${formatPct(sensex.changePct)})`,
  ]
  if (inrPart) parts.push(inrPart)
  if (vixPart) parts.push(vixPart)

  return parts.join(', ') + '.'
}

function longToday() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
