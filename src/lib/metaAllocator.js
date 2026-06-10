// Meta-allocator reader — pulls the decisions written by the Python compute
// service (quant/) from Supabase so the dashboard can render strategy-weight
// evolution, current allocation, and the confidence / anchor-blend state.
//
// Read-only and anon-key safe: the meta_* tables have public-read RLS policies
// (see supabase/meta_schema.sql). Writes only ever happen from Python via the
// service-role key.

import { supabase } from './supabase'

// Stable display order + colours for the known strategy sleeves. Unknown
// strategies fall back to a neutral grey so new sleeves still render.
const STRATEGY_META = {
  risk_parity: { label: 'Risk Parity (anchor)', color: '#3d5a80' },
  ts_momentum: { label: 'Trend / Momentum', color: '#9c6644' },
  mean_reversion: { label: 'Mean Reversion', color: '#5b8266' },
  sentiment_tilt: { label: 'Sentiment Tilt', color: '#8d6b94' },
}

export function strategyLabel(key) {
  return STRATEGY_META[key]?.label ?? key
}

export function strategyColor(key) {
  return STRATEGY_META[key]?.color ?? 'var(--color-muted)'
}

// ---- Current (latest) allocation -----------------------------------------

export async function fetchLatestAllocation() {
  if (!supabase) return null

  // Find the most recent decision date, then pull all rows for it.
  const { data: latest, error: e1 } = await supabase
    .from('meta_weights')
    .select('as_of')
    .order('as_of', { ascending: false })
    .limit(1)

  if (e1 || !latest || latest.length === 0) return null
  const asOf = latest[0].as_of

  const [{ data: weights }, { data: conf }] = await Promise.all([
    supabase.from('meta_weights').select('*').eq('as_of', asOf),
    supabase.from('confidence_log').select('*').eq('as_of', asOf).maybeSingle(),
  ])

  if (!weights || weights.length === 0) return null

  return {
    asOf,
    confidence: conf || null,
    strategies: weights
      .map((w) => ({
        strategy: w.strategy,
        label: strategyLabel(w.strategy),
        color: strategyColor(w.strategy),
        weightFinal: Number(w.weight_final),
        weightLearned: Number(w.weight_learned),
        reliability: w.reliability != null ? Number(w.reliability) : null,
        lcbSharpe: w.lcb_sharpe != null ? Number(w.lcb_sharpe) : null,
        isAnchor: !!w.is_anchor,
      }))
      .sort((a, b) => b.weightFinal - a.weightFinal),
  }
}

// ---- Weight evolution over time (for the stacked-area chart) -------------

export async function fetchWeightHistory({ limit = 180 } = {}) {
  if (!supabase) return { rows: [], strategies: [] }

  const { data, error } = await supabase
    .from('meta_weights')
    .select('as_of, strategy, weight_final')
    .order('as_of', { ascending: true })
    .limit(limit * 8) // several strategies per date

  if (error || !data || data.length === 0) return { rows: [], strategies: [] }

  // Pivot long -> wide: one row per date, one column per strategy.
  const byDate = new Map()
  const strategies = new Set()
  for (const r of data) {
    strategies.add(r.strategy)
    if (!byDate.has(r.as_of)) byDate.set(r.as_of, { as_of: r.as_of })
    byDate.get(r.as_of)[r.strategy] = Number(r.weight_final)
  }

  const rows = Array.from(byDate.values()).slice(-limit)
  return { rows, strategies: Array.from(strategies) }
}

// ---- Confidence history (for the trust dial / sparkline) -----------------

export async function fetchConfidenceHistory({ limit = 180 } = {}) {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('confidence_log')
    .select('as_of, c_raw, c_effective, anchor_blend, active_regime, regime_entropy')
    .order('as_of', { ascending: true })
    .limit(limit)

  if (error || !data) return []
  return data.map((r) => ({
    as_of: r.as_of,
    cRaw: Number(r.c_raw),
    cEffective: Number(r.c_effective),
    anchorBlend: Number(r.anchor_blend),
    activeRegime: r.active_regime,
    regimeEntropy: r.regime_entropy != null ? Number(r.regime_entropy) : null,
  }))
}

// ---- Regime breakdown (parsed from the latest confidence_log row) ---------

const REGIME_META = {
  risk_on: { label: 'Risk-On', color: '#5b8266', blurb: 'Trending, calm — lean into risk assets' },
  neutral: { label: 'Neutral', color: '#9c844a', blurb: 'Range-bound — no strong directional edge' },
  risk_off: { label: 'Risk-Off', color: '#9c6644', blurb: 'Weakening trend or rising vol — defensive' },
  crisis: { label: 'Crisis', color: '#8a2a2a', blurb: 'Deep drawdown + high vol — capital preservation' },
}

export function regimeLabel(key) {
  return REGIME_META[key]?.label ?? key
}

export function regimeColor(key) {
  return REGIME_META[key]?.color ?? 'var(--color-muted)'
}

export function regimeBlurb(key) {
  return REGIME_META[key]?.blurb ?? ''
}

function parseRegimeProbs(raw) {
  if (!raw) return {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed || {}
  } catch {
    return {}
  }
}

export async function fetchLatestRegime() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('confidence_log')
    .select('as_of, active_regime, regime_probs, regime_entropy')
    .order('as_of', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const probs = parseRegimeProbs(data.regime_probs)

  const ordered = Object.entries(probs)
    .map(([key, p]) => ({
      key,
      label: regimeLabel(key),
      color: regimeColor(key),
      blurb: regimeBlurb(key),
      prob: Number(p),
    }))
    .sort((a, b) => b.prob - a.prob)

  return {
    asOf: data.as_of,
    active: data.active_regime,
    entropy: data.regime_entropy != null ? Number(data.regime_entropy) : null,
    probs: ordered,
  }
}

export function formatWeightPct(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

// ---- Live recompute via the Python API -----------------------------------
// Calls /api/allocate, which runs the pipeline on fresh market prices and
// returns the decision. Falls back gracefully — the dashboard keeps showing
// cached Supabase data if this fails. The response is normalized into the same
// shape as fetchLatestAllocation()/fetchLatestRegime() so the UI can swap it in.

export async function runLiveAnalysis() {
  const token = import.meta.env.VITE_ALLOCATE_API_TOKEN
  const url = token
    ? `/api/allocate?token=${encodeURIComponent(token)}`
    : '/api/allocate'

  const res = await fetch(url, { method: 'GET' })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = await res.json()
      if (j?.error) detail = j.error
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  const data = await res.json()
  if (!data?.ok) throw new Error(data?.error || 'Live analysis failed')
  return normalizeLiveResponse(data)
}

function normalizeLiveResponse(data) {
  const strategies = (data.strategies || [])
    .map((s) => ({
      strategy: s.strategy,
      label: strategyLabel(s.strategy),
      color: strategyColor(s.strategy),
      weightFinal: Number(s.weight_final),
      weightLearned: Number(s.weight_learned),
      reliability: s.reliability != null ? Number(s.reliability) : null,
      lcbSharpe: s.lcb_sharpe != null ? Number(s.lcb_sharpe) : null,
      isAnchor: !!s.is_anchor,
    }))
    .sort((a, b) => b.weightFinal - a.weightFinal)

  const alloc = {
    asOf: data.as_of,
    confidence: {
      c_effective: Number(data.confidence?.c_effective ?? 0),
      anchor_blend: Number(data.confidence?.anchor_blend ?? 1),
      regime_entropy: data.confidence?.regime_entropy ?? null,
      notes: data.reasoning || '',
    },
    strategies,
  }

  const probsObj = data.regime_probs || {}
  const probs = Object.entries(probsObj)
    .map(([key, p]) => ({
      key,
      label: regimeLabel(key),
      color: regimeColor(key),
      blurb: regimeBlurb(key),
      prob: Number(p),
    }))
    .sort((a, b) => b.prob - a.prob)

  const regime = {
    asOf: data.as_of,
    active: data.active_regime,
    entropy: data.confidence?.regime_entropy ?? null,
    probs,
  }

  return { alloc, regime, persisted: !!data.persisted }
}

// ---- Client-side confidence blend ----------------------------------------
// Mirrors the Python meta_allocator._blend_to_anchor EXACTLY:
//   w_final = c * w_learned + (1 - c) * w_anchor
// where w_anchor places all weight on the anchor strategy. Because both the
// learned vector and the anchor vector each sum to 1, any convex blend also
// sums to 1 — so we can recompute the whole allocation for ANY confidence
// level instantly in the browser, with no backend call. This is what powers
// the interactive Confidence Explorer.

export function blendAllocation(strategies, c) {
  if (!strategies || strategies.length === 0) return []
  const clamped = Math.max(0, Math.min(1, c))
  const blended = strategies.map((s) => {
    const anchorComponent = s.isAnchor ? 1 : 0
    const w = clamped * (s.weightLearned ?? 0) + (1 - clamped) * anchorComponent
    return { ...s, weightBlend: w }
  })
  const total = blended.reduce((sum, s) => sum + s.weightBlend, 0)
  if (total <= 1e-9) return blended
  return blended
    .map((s) => ({ ...s, weightBlend: s.weightBlend / total }))
    .sort((a, b) => b.weightBlend - a.weightBlend)
}
