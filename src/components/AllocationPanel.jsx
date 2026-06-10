import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  fetchLatestAllocation,
  fetchWeightHistory,
  strategyColor,
  strategyLabel,
  formatWeightPct,
} from '../lib/metaAllocator'

// AllocationPanel — the "where is capital, and why" hero panel.
//
// Renders three things:
//   1. Current target weights (what we're actually trading = weight_final).
//   2. The meta-layer's reasoning + confidence / anchor-blend state.
//   3. Strategy-weight evolution over time (stacked area).
//
// In anchor-only mode this correctly shows 100% risk parity with the
// meta-layer's *learned* view visible underneath for transparency.

export default function AllocationPanel() {
  const [alloc, setAlloc] = useState(null)
  const [history, setHistory] = useState({ rows: [], strategies: [] })
  const [status, setStatus] = useState('loading') // loading | ready | empty

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [a, h] = await Promise.all([
          fetchLatestAllocation(),
          fetchWeightHistory(),
        ])
        if (cancelled) return
        setAlloc(a)
        setHistory(h)
        setStatus(a ? 'ready' : 'empty')
      } catch {
        if (!cancelled) setStatus('empty')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') return <Shell><Muted>Loading allocation…</Muted></Shell>
  if (status === 'empty') {
    return (
      <Shell>
        <Muted>
          No allocation decisions yet. Run the quant service
          (<code>python -m artha_quant.run --persist</code>) to populate
          this panel.
        </Muted>
      </Shell>
    )
  }

  const conf = alloc.confidence
  const cEff = conf ? Number(conf.c_effective) : 0
  const anchorOnly = cEff <= 1e-9

  return (
    <Shell>
      <Header asOf={alloc.asOf} regime={conf?.active_regime} />

      {/* Confidence / blend banner */}
      <ConfidenceBanner conf={conf} anchorOnly={anchorOnly} />

      {/* Current weights as horizontal bars */}
      <div style={{ marginTop: 28 }}>
        <SectionLabel>Current allocation</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {alloc.strategies.map((s) => (
            <WeightBar key={s.strategy} s={s} />
          ))}
        </div>
      </div>

      {/* Strategy-weight evolution */}
      {history.rows.length > 1 && (
        <div style={{ marginTop: 36 }}>
          <SectionLabel>Strategy-weight evolution</SectionLabel>
          <div style={{ height: 220, marginTop: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history.rows}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
                stackOffset="expand"
              >
                <XAxis
                  dataKey="as_of"
                  tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<WeightTooltip />} />
                {history.strategies.map((key) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="w"
                    stroke={strategyColor(key)}
                    fill={strategyColor(key)}
                    fillOpacity={0.7}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Shell>
  )
}

// ---- subcomponents --------------------------------------------------------

function ConfidenceBanner({ conf, anchorOnly }) {
  if (!conf) return null
  const cEff = Number(conf.c_effective)
  const anchorBlend = Number(conf.anchor_blend)

  return (
    <div
      style={{
        marginTop: 18,
        padding: '14px 16px',
        border: '1px solid var(--color-rule)',
        borderRadius: 4,
        background: anchorOnly ? 'rgba(61,90,128,0.06)' : 'transparent',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
          marginBottom: 8,
        }}
      >
        {anchorOnly ? 'Anchor-only · meta-layer observing' : 'Confidence-blended'}
      </div>

      {/* Blend bar: learned vs anchor */}
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: `${cEff * 100}%`,
            background: 'var(--color-ink)',
          }}
        />
        <div
          style={{
            width: `${anchorBlend * 100}%`,
            background: '#3d5a80',
          }}
        />
      </div>

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--color-muted)',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <span>confidence {(cEff * 100).toFixed(0)}%</span>
        <span>anchor {(anchorBlend * 100).toFixed(0)}%</span>
        {conf.regime_entropy != null && (
          <span>regime uncertainty {(Number(conf.regime_entropy) * 100).toFixed(0)}%</span>
        )}
      </div>

      {conf.notes && (
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--color-ink)',
          }}
        >
          {conf.notes}
        </p>
      )}
    </div>
  )
}

function WeightBar({ s }) {
  const pct = Math.max(0, Math.min(1, s.weightFinal))
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-ink)' }}>
          {s.label}
          {s.isAnchor && (
            <span style={{ color: 'var(--color-muted)', fontSize: 11 }}> · anchor</span>
          )}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--color-muted)',
          }}
        >
          {formatWeightPct(s.weightFinal)}
          {s.reliability != null && (
            <span style={{ opacity: 0.7 }}> · ρ {s.reliability.toFixed(2)}</span>
          )}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--color-rule)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ height: '100%', background: s.color }}
        />
      </div>
    </div>
  )
}

function WeightTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        background: 'var(--color-paper, #fff)',
        border: '1px solid var(--color-rule)',
        borderRadius: 4,
        padding: '8px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      <div style={{ color: 'var(--color-muted)', marginBottom: 6 }}>{label}</div>
      {payload
        .slice()
        .reverse()
        .map((p) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {strategyLabel(p.dataKey)}: {formatWeightPct(p.value)}
          </div>
        ))}
    </div>
  )
}

function Header({ asOf, regime }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(20px, 3vw, 26px)',
          letterSpacing: '-0.02em',
          margin: 0,
        }}
      >
        Capital Allocation
      </h2>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}
      >
        {regime ? `${regime} · ` : ''}{asOf}
      </span>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--color-muted)',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  )
}

function Shell({ children }) {
  return (
    <section
      style={{
        border: '1px solid var(--color-rule)',
        borderRadius: 6,
        padding: 'clamp(20px, 4vw, 32px)',
        background: 'var(--color-paper, transparent)',
      }}
    >
      {children}
    </section>
  )
}

function Muted({ children }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}
