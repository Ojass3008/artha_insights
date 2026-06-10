import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  fetchLatestAllocation,
  fetchWeightHistory,
  fetchLatestRegime,
  runLiveAnalysis,
  blendAllocation,
  strategyColor,
  strategyLabel,
  formatWeightPct,
} from '../lib/metaAllocator'
import { isAllocatorUnlocked, tryUnlockAllocator } from '../lib/adminGate'
import Term from '../components/Term'

/* ============================================================
   Allocator — an interactive capital-allocation tool.
   Beginner-friendly (Simple mode + inline glossary) and
   professional (Pro mode + full ledger). The Confidence
   Explorer recomputes the live blend in the browser.
   ============================================================ */

export default function Allocator() {
  const [unlocked, setUnlocked] = useState(isAllocatorUnlocked())
  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />
  return <Dashboard />
}

/* ---------------- optional gate ---------------- */

function Gate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (tryUnlockAllocator(value.trim())) onUnlock()
    else setError(true)
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - var(--header-h))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}
      >
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          Internal · Restricted
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(28px, 6vw, 40px)', letterSpacing: '-0.02em', marginBottom: 12 }}>
          The Allocator
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: 28 }}>
          Enter the access key to continue.
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false) }}
          placeholder="Access key"
          autoFocus
          style={{
            width: '100%', padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 14,
            background: 'var(--color-paper-2)',
            border: `1px solid ${error ? 'var(--color-oxblood)' : 'var(--color-rule-2)'}`,
            borderRadius: 4, color: 'var(--color-ink)', outline: 'none', textAlign: 'center', letterSpacing: '0.1em',
          }}
        />
        {error && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-oxblood)', fontFamily: 'var(--font-mono)' }}>Incorrect key.</div>}
        <button type="submit" style={{ marginTop: 20, width: '100%', padding: '14px', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', background: 'var(--color-ink)', color: 'var(--color-paper)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Unlock
        </button>
      </motion.form>
    </div>
  )
}

/* ---------------- dashboard ---------------- */

function Dashboard() {
  const [alloc, setAlloc] = useState(null)
  const [regime, setRegime] = useState(null)
  const [history, setHistory] = useState({ rows: [], strategies: [] })
  const [status, setStatus] = useState('loading')
  const [mode, setMode] = useState('simple') // 'simple' | 'pro'
  const [live, setLive] = useState({ state: 'idle', error: null, at: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [a, r, h] = await Promise.all([
          fetchLatestAllocation(),
          fetchLatestRegime(),
          fetchWeightHistory(),
        ])
        if (cancelled) return
        setAlloc(a); setRegime(r); setHistory(h)
        setStatus(a ? 'ready' : 'empty')
      } catch {
        if (!cancelled) setStatus('empty')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleRunLive() {
    setLive({ state: 'running', error: null, at: null })
    try {
      const { alloc: a, regime: r } = await runLiveAnalysis()
      setAlloc(a)
      setRegime(r)
      setStatus('ready')
      setLive({ state: 'done', error: null, at: new Date() })
      // Refresh history in the background (it was just persisted).
      fetchWeightHistory().then(setHistory).catch(() => {})
    } catch (e) {
      setLive({ state: 'error', error: e.message || 'Failed', at: null })
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 'clamp(24px, 5vw, 56px) clamp(20px, 5vw, 48px) 120px' }}>
      <Hero asOf={alloc?.asOf} mode={mode} setMode={setMode} live={live} onRunLive={handleRunLive} />

      {status === 'loading' && <Muted>Loading allocation intelligence…</Muted>}
      {status === 'empty' && <EmptyState />}

      {status === 'ready' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
            <RegimeCard regime={regime} />
            <LiveConfidenceCard conf={alloc.confidence} />
          </div>

          {/* The interactive centerpiece */}
          <ConfidenceExplorer alloc={alloc} />

          {/* Reasoning */}
          {alloc.confidence?.notes && (
            <Card>
              <CardLabel>What the system is thinking</CardLabel>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 1.6vw, 17px)', lineHeight: 1.7, color: 'var(--color-ink-2)', margin: 0 }}>
                {alloc.confidence.notes}
              </p>
            </Card>
          )}

          {/* Pro-only depth */}
          {mode === 'pro' && (
            <>
              <Card>
                <CardLabel>Strategy ledger</CardLabel>
                <StrategyTable strategies={alloc.strategies} />
              </Card>
              {history.rows.length > 1 && (
                <Card>
                  <CardLabel>Strategy-weight evolution</CardLabel>
                  <EvolutionChart history={history} />
                </Card>
              )}
            </>
          )}

          {mode === 'simple' && (
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}>
              Want the full ledger, reliability scores and history?{' '}
              <button onClick={() => setMode('pro')} style={linkBtn}>Switch to Pro view →</button>
            </p>
          )}

          <Disclaimer />
        </>
      )}
    </div>
  )
}

/* ---------------- hero + mode toggle ---------------- */

function Hero({ asOf, mode, setMode, live, onRunLive }) {
  const running = live?.state === 'running'
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Capital Intelligence</div>
        <ModeToggle mode={mode} setMode={setMode} />
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'clamp(34px, 7vw, 64px)', lineHeight: 1.04, letterSpacing: '-0.025em', margin: '0 0 18px' }}>
        Where capital should sit,{' '}
        <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>and why.</span>
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-muted)', maxWidth: '56ch', lineHeight: 1.65, margin: '0 0 24px' }}>
        An interactive, <Term k="regime">regime</Term>-aware allocator built on{' '}
        <Term k="regret_minimization">regret minimization</Term>. It reweights strategies by how{' '}
        <Term k="reliability">reliable</Term> they have been lately, and falls back to a safe{' '}
        <Term k="anchor">anchor</Term> when unsure.
        {asOf && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}> · as of {asOf}</span>}
      </p>

      {/* Live recompute control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          onClick={onRunLive}
          disabled={running}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '11px 20px', borderRadius: 999,
            fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase',
            background: running ? 'var(--color-paper-3)' : 'var(--color-ink)',
            color: running ? 'var(--color-muted)' : 'var(--color-paper)',
            border: 'none', cursor: running ? 'wait' : 'pointer', transition: 'all 0.2s',
          }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: running ? 'var(--color-muted)' : '#5b8266',
            animation: running ? 'pulse 1s ease-in-out infinite' : 'none',
          }} />
          {running ? 'Analyzing fresh prices…' : 'Run live analysis'}
        </button>

        {live?.state === 'done' && live.at && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
            ✓ updated {live.at.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {live?.state === 'error' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-oxblood)' }}>
            ✕ {live.error}
          </span>
        )}
      </div>
    </div>
  )
}

function ModeToggle({ mode, setMode }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--color-rule-2)', borderRadius: 999, padding: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      {['simple', 'pro'].map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          style={{
            padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            background: mode === m ? 'var(--color-ink)' : 'transparent',
            color: mode === m ? 'var(--color-paper)' : 'var(--color-muted)',
            transition: 'all 0.2s',
          }}
        >
          {m === 'simple' ? 'Simple' : 'Pro'}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Confidence Explorer (the interactive core) ---------------- */

function ConfidenceExplorer({ alloc }) {
  const liveC = Number(alloc.confidence?.c_effective ?? 0)
  const [c, setC] = useState(liveC)

  const blended = useMemo(() => blendAllocation(alloc.strategies, c), [alloc.strategies, c])
  const atLive = Math.abs(c - liveC) < 0.005

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <CardLabel>Confidence Explorer</CardLabel>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)' }}>
          drag to simulate
        </span>
      </div>

      <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '60ch' }}>
        How much should we <Term k="confidence">trust</Term> the system&apos;s view versus holding the safe{' '}
        <Term k="anchor">anchor</Term>? Drag the slider and watch capital move. This is the exact blend the
        engine uses: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>final = c × learned + (1−c) × anchor</code>.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 230px) 1fr', gap: 'clamp(20px, 4vw, 48px)', alignItems: 'center' }} className="alloc-grid">
        <AllocationDonut strategies={blended} weightKey="weightBlend" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {blended.map((s) => (
            <WeightBar key={s.strategy} s={s} weightKey="weightBlend" />
          ))}
        </div>
      </div>

      {/* Slider */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
            Confidence
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>
            {(c * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range" min="0" max="1" step="0.01" value={c}
          onChange={(e) => setC(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-oxblood)', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-muted-2)' }}>
          <span>Safe · pure anchor</span>
          <span>Aggressive · full trust</span>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setC(liveC)} style={{ ...linkBtn, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em' }}>
            ↺ Reset to live ({(liveC * 100).toFixed(0)}%)
          </button>
          {atLive ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-oxblood)', letterSpacing: '0.06em' }}>
              ● showing the system&apos;s actual live decision
            </span>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted-2)', letterSpacing: '0.06em' }}>
              simulated — not the live decision
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ---------------- regime card ---------------- */

function RegimeCard({ regime }) {
  if (!regime) return null
  const top = regime.probs[0]
  return (
    <Card flush>
      <CardLabel><Term k="regime">Market regime</Term></CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em', color: top?.color }}>
          {top?.label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-muted)' }}>
          {(top?.prob * 100).toFixed(0)}%
        </span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 18px', lineHeight: 1.5 }}>{top?.blurb}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {regime.probs.map((r) => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)', width: 64, flexShrink: 0 }}>{r.label}</span>
            <div style={{ flex: 1, height: 5, background: 'var(--color-rule)', borderRadius: 3, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${r.prob * 100}%` }} transition={{ duration: 0.7 }} style={{ height: '100%', background: r.color }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', width: 34, textAlign: 'right' }}>{(r.prob * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------------- live confidence card ---------------- */

function LiveConfidenceCard({ conf }) {
  if (!conf) return null
  const cEff = Number(conf.c_effective)
  const anchorBlend = Number(conf.anchor_blend)
  const anchorOnly = cEff <= 1e-9
  return (
    <Card flush>
      <CardLabel><Term k="confidence">System confidence</Term></CardLabel>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 500, letterSpacing: '-0.02em' }}>{(cEff * 100).toFixed(0)}%</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: anchorOnly ? 'var(--color-oxblood)' : 'var(--color-muted)' }}>
          {anchorOnly ? 'Anchor-only · observing' : 'Confidence-blended'}
        </span>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10, background: 'var(--color-rule)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${cEff * 100}%` }} transition={{ duration: 0.7 }} style={{ background: 'var(--color-ink)' }} />
        <motion.div initial={{ width: 0 }} animate={{ width: `${anchorBlend * 100}%` }} transition={{ duration: 0.7 }} style={{ background: '#3d5a80' }} />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>● learned {(cEff * 100).toFixed(0)}%</span>
        <span style={{ color: '#3d5a80' }}>● anchor {(anchorBlend * 100).toFixed(0)}%</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-muted-2)', margin: '16px 0 0', lineHeight: 1.55 }}>
        The system only departs from the safe baseline in proportion to how much it trusts its view. Low confidence → it holds the anchor.
      </p>
    </Card>
  )
}

/* ---------------- donut ---------------- */

function AllocationDonut({ strategies, weightKey = 'weightFinal' }) {
  const data = strategies.filter((s) => (s[weightKey] ?? 0) > 0.001).map((s) => ({ name: s.label, value: s[weightKey], color: s.color }))
  const top = strategies[0]
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', minWidth: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="62%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 500 }}>
          {formatWeightPct(top?.[weightKey])}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)', textAlign: 'center', maxWidth: '72%' }}>
          {top?.label}
        </span>
      </div>
    </div>
  )
}

/* ---------------- weight bar ---------------- */

function WeightBar({ s, weightKey = 'weightFinal' }) {
  const val = s[weightKey] ?? 0
  const pct = Math.max(0, Math.min(1, val))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
          {s.label}
          {s.isAnchor && <span style={{ color: 'var(--color-muted-2)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>ANCHOR</span>}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ink-2)' }}>{formatWeightPct(val)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--color-rule)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} style={{ height: '100%', background: s.color }} />
      </div>
    </div>
  )
}

/* ---------------- strategy table (pro) ---------------- */

function StrategyTable({ strategies }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr 0.8fr', gap: 12, padding: '0 0 10px', borderBottom: '1px solid var(--color-rule-2)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
        <span>Strategy</span>
        <span style={{ textAlign: 'right' }}>Final</span>
        <span style={{ textAlign: 'right' }}><Term k="reliability">Reliability</Term></span>
        <span style={{ textAlign: 'right' }}><Term k="lcb_sharpe">LCB Sharpe</Term></span>
      </div>
      {strategies.map((s) => (
        <div key={s.strategy} style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr 0.8fr 0.8fr', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--color-rule)', alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }} />
            {s.label}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right' }}>{formatWeightPct(s.weightFinal)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right', color: reliColor(s.reliability) }}>{s.reliability != null ? s.reliability.toFixed(2) : '—'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'right', color: s.lcbSharpe >= 0 ? 'var(--color-ink-2)' : 'var(--color-oxblood)' }}>{s.lcbSharpe != null ? (s.lcbSharpe >= 0 ? '+' : '') + s.lcbSharpe.toFixed(2) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function reliColor(r) {
  if (r == null) return 'var(--color-muted)'
  if (r >= 0.6) return '#5b8266'
  if (r >= 0.3) return '#9c844a'
  return 'var(--color-muted)'
}

/* ---------------- evolution chart (pro) ---------------- */

function EvolutionChart({ history }) {
  return (
    <div style={{ height: 240, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history.rows} margin={{ top: 4, right: 8, bottom: 0, left: -14 }} stackOffset="expand">
          <XAxis dataKey="as_of" tick={{ fontSize: 10, fill: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--color-rule)' }} minTickGap={56} />
          <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10, fill: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<WeightTooltip />} />
          {history.strategies.map((key) => (
            <Area key={key} type="monotone" dataKey={key} stackId="w" stroke={strategyColor(key)} fill={strategyColor(key)} fillOpacity={0.78} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function WeightTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{ background: 'var(--color-paper)', border: '1px solid var(--color-rule-2)', borderRadius: 4, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ color: 'var(--color-muted)', marginBottom: 6 }}>{label}</div>
      {payload.slice().reverse().map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>{strategyLabel(p.dataKey)}: {formatWeightPct(p.value)}</div>
      ))}
    </div>
  )
}

/* ---------------- shared bits ---------------- */

const linkBtn = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--color-oxblood)', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit',
}

function Card({ children, flush = false }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ border: '1px solid var(--color-rule)', borderRadius: 8, padding: flush ? 'clamp(20px, 3vw, 28px)' : 'clamp(22px, 3.5vw, 32px)', background: 'var(--color-paper-2)', marginBottom: 20 }}
    >
      {children}
    </motion.section>
  )
}

function CardLabel({ children }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 18 }}>
      {children}
    </div>
  )
}

function Muted({ children }) {
  return <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6, padding: '40px 0' }}>{children}</div>
}

function EmptyState() {
  return (
    <Card>
      <CardLabel>No data yet</CardLabel>
      <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.7, margin: 0 }}>
        No allocation decisions have been recorded. Run the quant service
        (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>python -m artha_quant.run --persist</code>)
        or wait for the daily scheduled run to populate this view.
      </p>
    </Card>
  )
}

function Disclaimer() {
  return (
    <p style={{ marginTop: 40, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--color-muted-2)', textAlign: 'center' }}>
      Research system · Not investment advice · Anchor-safe by default
    </p>
  )
}
