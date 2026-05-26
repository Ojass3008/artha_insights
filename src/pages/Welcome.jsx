import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { saveProfile } from '../lib/profile'

/* ============================================================
   Welcome / Orientation
   --------------------------------------------------
   Inverted theme. Ink background. Paper text. Oxblood accent.
   Pure typography — no boxes, no chrome. Everything centered.

   Mark sequence:
     1. अर्था          (Devanagari, in Eczar — pairs with Fraunces)
     2. ₹             (rupee glyph)
     3. अर्था INSIGHTS (lockup)
     4. $             (dollar glyph)
     5. अर्था          (closing — return to the start)
   ============================================================ */

const STEPS = [
  {
    kind: 'mark',
    mark: { type: 'word' },
    eyebrow: 'Welcome',
    title: 'A small introduction first.',
    body: 'Artha is built around how you actually read. Four quiet questions. Sixty seconds.',
    cta: 'Begin',
  },
  {
    kind: 'choice',
    field: 'level',
    mark: { type: 'glyph', value: '₹' },
    eyebrow: 'Question 01',
    title: 'Where are you in your finance journey?',
    options: [
      { value: 'curious', label: 'Curious beginner' },
      { value: 'active', label: 'Active investor' },
      { value: 'pro', label: 'Finance professional' },
      { value: 'founder', label: 'Founder or operator' },
    ],
  },
  {
    kind: 'multi',
    field: 'interests',
    mark: { type: 'lockup' },
    eyebrow: 'Question 02',
    title: 'What pulls you most?',
    sub: 'Pick any that fit.',
    options: [
      { value: 'markets', label: 'Markets & equities' },
      { value: 'startups', label: 'Startups & venture' },
      { value: 'macro', label: 'Macro & policy' },
      { value: 'personal', label: 'Personal capital' },
    ],
    cta: 'Continue',
  },
  {
    kind: 'choice',
    field: 'depth',
    mark: { type: 'glyph', value: '$' },
    eyebrow: 'Question 03',
    title: 'How do you prefer to read?',
    options: [
      { value: 'quick', label: 'Quick, under five minutes' },
      { value: 'deep', label: 'Deep dives, twenty minutes plus' },
      { value: 'both', label: 'Both, depending on the morning' },
    ],
  },
  {
    kind: 'name',
    field: 'name',
    mark: { type: 'word' },
    eyebrow: 'Last one',
    title: 'What should we call you?',
    placeholder: 'First name (optional)',
    cta: 'Enter Artha',
  },
]

export default function Welcome() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState({
    level: '',
    interests: [],
    depth: '',
    name: '',
  })
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const canAdvance = useMemo(() => {
    if (current.kind === 'mark') return true
    if (current.kind === 'name') return true
    if (current.kind === 'multi') return profile.interests.length > 0
    if (current.kind === 'choice') return !!profile[current.field]
    return false
  }, [current, profile])

  const advance = () => {
    if (!canAdvance) return
    if (isLast) {
      setExiting(true)
      setTimeout(() => {
        saveProfile(profile)
        navigate('/', { replace: true })
      }, 1100)
      return
    }
    setStep((s) => s + 1)
  }

  const skip = () => {
    saveProfile({ ...profile, skipped: true })
    navigate('/', { replace: true })
  }

  const select = (value) => {
    if (current.kind === 'multi') {
      setProfile((p) => {
        const has = p.interests.includes(value)
        return {
          ...p,
          interests: has
            ? p.interests.filter((v) => v !== value)
            : [...p.interests, value],
        }
      })
      return
    }
    setProfile((p) => ({ ...p, [current.field]: value }))
    setTimeout(() => {
      if (step < STEPS.length - 1) setStep((s) => s + 1)
    }, 420)
  }

  const showCTA =
    current.kind === 'mark' || current.kind === 'multi' || current.kind === 'name'

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at center, #161310 0%, #0B0908 80%)',
        color: '#F5F1E8',
      }}
    >
      {/* TOP META */}
      <div className="absolute top-0 left-0 right-0 z-10 px-8 md:px-14 pt-10 flex items-center justify-between">
        <span style={metaStyle}>Artha · Orientation</span>
        <button
          onClick={skip}
          style={{ ...metaStyle, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          Skip
        </button>
      </div>

      {/* PROGRESS LINE */}
      <div className="absolute top-[88px] left-8 right-8 md:left-14 md:right-14 h-px bg-[rgba(245,241,232,0.08)]">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: (step + 1) / STEPS.length }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: '0% 50%', background: '#C8856A' }}
          className="h-px"
        />
      </div>

      {/* CENTER STAGE */}
      <div className="absolute inset-0 flex items-center justify-center px-6 md:px-14">
        <div className="w-full max-w-[520px] flex flex-col items-center text-center">

          {/* MARK */}
          <div
            style={{
              minHeight: 'clamp(96px, 16vh, 160px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 56,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`mark-${step}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <Mark mark={current.mark} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* TEXT BLOCK */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <div style={eyebrowStyle}>{current.eyebrow}</div>

              <h1 style={titleStyle}>{current.title}</h1>

              {(current.body || current.sub) && (
                <p style={bodyStyle}>{current.body || current.sub}</p>
              )}

              {/* Choice / Multi options — typographic rows, no boxes */}
              {(current.kind === 'choice' || current.kind === 'multi') && (
                <ul className="mt-12 flex flex-col items-center">
                  {current.options.map((opt) => {
                    const selected =
                      current.kind === 'multi'
                        ? profile.interests.includes(opt.value)
                        : profile[current.field] === opt.value
                    return (
                      <Option
                        key={opt.value}
                        label={opt.label}
                        selected={selected}
                        onClick={() => select(opt.value)}
                      />
                    )
                  })}
                </ul>
              )}

              {/* Text input */}
              {current.kind === 'name' && (
                <div className="mt-12 max-w-[380px] mx-auto">
                  <input
                    type="text"
                    autoFocus
                    value={profile.name}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, name: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') advance()
                    }}
                    placeholder={current.placeholder}
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderBottomColor = '#C8856A')
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderBottomColor =
                        'rgba(245,241,232,0.25)')
                    }
                  />
                </div>
              )}

              {/* CTA — line-based, no fill */}
              {showCTA && (
                <button
                  onClick={advance}
                  disabled={!canAdvance}
                  style={ctaStyle(canAdvance)}
                  className="mt-14 group"
                >
                  <span>{current.cta}</span>
                  <span
                    aria-hidden
                    style={{
                      marginLeft: 16,
                      transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                      display: 'inline-block',
                    }}
                    className="group-hover:translate-x-2"
                  >
                    →
                  </span>
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* BOTTOM STEP COUNTER */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        style={metaStyle}
      >
        {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
      </div>

      {/* PAPER CURTAIN */}
      <AnimatePresence>
        {exiting && (
          <motion.div
            key="curtain"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-[90]"
            style={{ background: '#F5F1E8' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ============================================================
   Mark — three forms
   ============================================================ */

function Mark({ mark }) {
  if (mark.type === 'word' || mark.type === 'lockup') {
    return <BrandLockup compact={mark.type === 'word'} />
  }
  if (mark.type === 'glyph') {
    return <span style={glyphStyle}>{mark.value}</span>
  }
  return null
}

/* Combined Devanagari + Latin lockup — slim, restrained */
function BrandLockup({ compact = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <span
        style={{
          ...devaWordStyle,
          fontSize: compact
            ? 'clamp(48px, 7vw, 84px)'
            : 'clamp(40px, 6vw, 70px)',
        }}
      >
        अर्था
      </span>

      <span
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 300,
          fontStyle: 'normal',
          fontSize: compact
            ? 'clamp(11px, 1.1vw, 13px)'
            : 'clamp(10px, 1vw, 12px)',
          letterSpacing: '0.46em',
          textTransform: 'uppercase',
          color: 'rgba(245, 241, 232, 0.7)',
          paddingLeft: '0.46em',
          fontVariationSettings: '"opsz" 144',
        }}
      >
        Artha · Insights
      </span>
    </div>
  )
}

/* ============================================================
   Option — pure typography, no border, no background
   Selection state shows up as a thin oxblood underline + indicator
   ============================================================ */

function Option({ label, selected, onClick }) {
  return (
    <li className="w-full">
      <button
        onClick={onClick}
        className="group relative inline-flex items-center justify-center gap-4 py-4 transition-all w-full"
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 19,
          fontWeight: 400,
          letterSpacing: '-0.005em',
          color: selected
            ? '#F5F1E8'
            : 'rgba(245, 241, 232, 0.55)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.color = 'rgba(245,241,232,0.95)'
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.color = 'rgba(245,241,232,0.55)'
        }}
      >
        <span>{label}</span>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 0,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            letterSpacing: '0.18em',
            color: selected ? '#C8856A' : 'rgba(245,241,232,0.18)',
            transition: 'color 0.3s ease',
          }}
        >
          {selected ? '◆' : ''}
        </span>

        {/* hairline underline that grows on selection */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            height: 1,
            width: selected ? '100%' : '0%',
            background: '#6E1F1F',
            transition: 'width 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        {/* always-on faint hairline so the row reads as a row */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background: 'rgba(245,241,232,0.06)',
          }}
        />
      </button>
    </li>
  )
}

/* ============================================================
   Styles
   ============================================================ */

const metaStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: '0.32em',
  textTransform: 'uppercase',
  color: 'rgba(245, 241, 232, 0.55)',
}

const eyebrowStyle = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  color: '#C8856A',
  marginBottom: 18,
}

const titleStyle = {
  fontFamily: "'Fraunces', serif",
  fontWeight: 400,
  fontSize: 'clamp(28px, 4vw, 40px)',
  lineHeight: 1.18,
  letterSpacing: '-0.02em',
  color: '#F5F1E8',
  fontVariationSettings: '"opsz" 144',
  margin: 0,
}

const bodyStyle = {
  marginTop: 18,
  fontFamily: "'Inter', sans-serif",
  fontSize: 15,
  lineHeight: 1.65,
  color: 'rgba(245,241,232,0.62)',
  maxWidth: 440,
  marginInline: 'auto',
  fontWeight: 300,
}

// Devanagari word mark — Eczar pairs precisely with Fraunces
const devaWordStyle = {
  fontFamily: "'Eczar', 'Fraunces', serif",
  fontSize: 'clamp(56px, 9vw, 104px)',
  fontWeight: 400,
  lineHeight: 1,
  letterSpacing: '-0.005em',
  color: '#F5F1E8',
  display: 'inline-block',
}

const glyphStyle = {
  fontFamily: "'Fraunces', serif",
  fontSize: 'clamp(80px, 12vw, 144px)',
  fontWeight: 300,
  lineHeight: 1,
  letterSpacing: '-0.03em',
  color: '#F5F1E8',
  fontVariationSettings: '"opsz" 144',
  display: 'inline-block',
}

const inputStyle = {
  width: '100%',
  padding: '16px 0',
  background: 'transparent',
  fontFamily: "'Fraunces', serif",
  fontSize: 22,
  color: '#F5F1E8',
  textAlign: 'center',
  border: 'none',
  borderBottom: '1px solid rgba(245,241,232,0.25)',
  outline: 'none',
  transition: 'border-bottom-color 0.25s ease',
}

// Line-based CTA — no fill, no border
function ctaStyle(enabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 4px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    background: 'transparent',
    color: enabled ? '#F5F1E8' : 'rgba(245,241,232,0.3)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    border: 'none',
    borderBottom: enabled
      ? '1px solid rgba(245,241,232,0.5)'
      : '1px solid rgba(245,241,232,0.15)',
    borderRadius: 0,
    transition: 'all 0.3s ease',
  }
}
