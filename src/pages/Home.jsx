import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { BRIEFS } from '../content/briefs'
import PulseStrip from '../components/PulseStrip'
import SceneIndex from '../components/SceneIndex'

const SCENES = [
  { id: 'masthead', label: 'Masthead' },
  { id: 'pulse', label: 'The Pulse' },
  { id: 'brief', label: 'The Brief' },
  { id: 'invitation', label: 'Invitation' },
]

export default function Home() {
  const latest = BRIEFS[0]

  return (
    <div style={{ marginTop: 'calc(var(--header-h) * -1)' }}>
      <ProgressBar />
      <SceneIndex scenes={SCENES} />

      <Masthead />
      <PulseScene />
      <BriefScene latest={latest} />
      <InvitationScene />
    </div>
  )
}

/* ============================================================
   Shared scaffold for full-viewport scenes
   ============================================================ */

function Scene({ id, children, className = '', dark = false }) {
  return (
    <section
      id={id}
      className={`relative w-full ${className}`}
      style={{
        minHeight: '100vh',
        background: dark
          ? 'var(--color-paper-2)'
          : 'var(--color-paper)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(80px, 8vw, 120px) clamp(20px, 5vw, 80px) clamp(80px, 8vw, 120px)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 980,
            textAlign: 'center',
          }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   Progress bar
   ============================================================ */

function ProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.6,
  })
  return (
    <motion.div
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-[var(--color-oxblood)]"
    />
  )
}

/* ============================================================
   1 — MASTHEAD (full hero, watermark, slow rise on scroll)
   ============================================================ */

function Masthead() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const smooth = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.5,
  })

  const rupeeY = useTransform(smooth, [0, 1], [0, -200])
  const rupeeOpacity = useTransform(smooth, [0, 0.7, 1], [1, 0.4, 0])
  const titleY = useTransform(smooth, [0, 1], [0, -140])
  const titleOpacity = useTransform(smooth, [0, 0.5], [1, 0])

  return (
    <section id="masthead" ref={ref} className="relative h-[160vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[var(--color-paper)]">
        {/* Watermark ₹ */}
        <motion.div
          aria-hidden
          style={{ y: rupeeY, opacity: rupeeOpacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(280px, 78vw, 1100px)',
              fontWeight: 300,
              lineHeight: 0.8,
              color: 'transparent',
              WebkitTextStroke: '1px rgba(110, 31, 31, 0.06)',
              letterSpacing: '-0.04em',
            }}
          >
            ₹
          </span>
        </motion.div>

        {/* Top corner meta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-0 left-0 right-0 z-10"
        >
          <div className="mx-auto max-w-[1400px] px-6 sm:px-10 md:px-14 pt-24 sm:pt-28 flex items-center justify-between">
            <span
              className="text-[9px] sm:text-[10px] tracking-[0.32em] uppercase text-[var(--color-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Volume 01
            </span>
            <span
              className="text-[9px] sm:text-[10px] tracking-[0.32em] uppercase text-[var(--color-muted)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {todayLabel()}
            </span>
          </div>
        </motion.div>

        {/* Center stage */}
        <motion.div
          style={{ y: titleY, opacity: titleOpacity }}
          className="relative z-10 h-full flex flex-col items-center justify-center px-6 sm:px-8 text-center"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, delay: 0.4 }}
            className="eyebrow mb-8 sm:mb-12"
          >
            Artha Insights
          </motion.div>

          <h1
            className="max-w-[18ch] tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(38px, 8vw, 124px)',
              fontWeight: 400,
              lineHeight: 0.96,
              letterSpacing: '-0.03em',
            }}
          >
            {[
              { text: 'Markets', delay: 0.7 },
              { text: 'and money', delay: 0.85 },
              { text: 'the way a', delay: 1.0 },
              { text: 'builder', italic: true, delay: 1.15 },
              { text: 'sees them.', delay: 1.3 },
            ].map((line, i) => (
              <span key={i} className="block">
                <RevealWord delay={line.delay} italic={line.italic}>
                  {line.text}
                </RevealWord>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 1.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 sm:mt-12 max-w-[42ch] text-[14px] sm:text-[16px] leading-[1.7] text-[var(--color-ink-3)] px-4"
          >
            A weekly Brief written from inside the machine.
          </motion.p>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4"
        >
          <span
            className="text-[10px] tracking-[0.32em] uppercase text-[var(--color-muted)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Scroll
          </span>
          <motion.span
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: 'top' }}
            className="block w-px h-12 bg-[var(--color-rule-2)]"
          />
        </motion.div>
      </div>
    </section>
  )
}

function RevealWord({ children, delay = 0, italic = false }) {
  return (
    <span
      className="inline-block overflow-hidden align-bottom"
      style={{ paddingBottom: '0.05em' }}
    >
      <motion.span
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
        className="inline-block"
        style={
          italic
            ? {
                fontStyle: 'italic',
                color: 'var(--color-oxblood)',
                fontWeight: 400,
              }
            : undefined
        }
      >
        {children}
      </motion.span>
    </span>
  )
}

/* ============================================================
   2 — PULSE SCENE — full viewport, breathing room
   ============================================================ */

function PulseScene() {
  return (
    <Scene id="pulse">
      <RevealStack>
        <div className="eyebrow mb-4">Today</div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(40px, 7vw, 88px)',
            lineHeight: 1.03,
            letterSpacing: '-0.025em',
            maxWidth: '14ch',
            margin: '0 auto 80px',
          }}
        >
          The{' '}
          <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>
            pulse.
          </span>
        </h2>

        <PulseStrip />

        <div
          style={{
            marginTop: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <span
            className="text-[10px] tracking-[0.24em] uppercase text-[var(--color-muted-2)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Auto-refreshed · Yahoo Finance
          </span>
          <Link
            to="/today"
            className="text-[11px] tracking-[0.22em] uppercase text-[var(--color-muted)] hover:text-[var(--color-oxblood)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Full snapshot →
          </Link>
        </div>
      </RevealStack>
    </Scene>
  )
}

/* ============================================================
   3 — BRIEF SCENE — full viewport, single dominant headline
   ============================================================ */

function BriefScene({ latest }) {
  return (
    <Scene id="brief" dark>
      <RevealStack>
        <div className="eyebrow mb-4">This Sunday</div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            marginBottom: 48,
          }}
        >
          The Brief №{String(BRIEFS.length).padStart(2, '0')} ·{' '}
          {formatDate(latest.date)}
        </div>

        <Link to={`/brief/${latest.slug}`} className="group" style={{ display: 'block' }}>
          <h2
            className="group-hover:text-[var(--color-oxblood)]"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 'clamp(48px, 8.5vw, 112px)',
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              maxWidth: '12ch',
              margin: '0 auto 48px',
              transition: 'color 0.7s',
            }}
          >
            {latest.title}
          </h2>

          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(18px, 2.2vw, 26px)',
              lineHeight: 1.5,
              color: 'var(--color-ink-3)',
              maxWidth: '46ch',
              margin: '0 auto 48px',
            }}
          >
            {latest.dek}
          </p>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-2)',
            }}
            className="group-hover:text-[var(--color-oxblood)] transition-colors duration-500"
          >
            <span
              className="group-hover:bg-[var(--color-oxblood)]"
              style={{
                display: 'inline-block',
                height: 1,
                width: 48,
                background: 'var(--color-ink-2)',
                transition: 'all 0.7s',
              }}
            />
            Read · {latest.readTime}
          </span>
        </Link>

        <div style={{ marginTop: 64 }}>
          <Link
            to="/archive"
            className="text-[11px] tracking-[0.22em] uppercase text-[var(--color-muted)] hover:text-[var(--color-oxblood)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            All Briefs →
          </Link>
        </div>
      </RevealStack>
    </Scene>
  )
}

/* ============================================================
   4 — INVITATION SCENE
   ============================================================ */

function InvitationScene() {
  return (
    <Scene id="invitation">
      <RevealStack>
        <div className="eyebrow mb-4">An invitation</div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(44px, 7.5vw, 96px)',
            lineHeight: 1,
            letterSpacing: '-0.025em',
            maxWidth: '14ch',
            margin: '0 auto 56px',
          }}
        >
          One Brief.{' '}
          <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>
            Sundays only.
          </span>
        </h2>

        <p
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: 'var(--color-ink-3)',
            maxWidth: '42ch',
            margin: '0 auto 48px',
          }}
        >
          Slow reading. Sharp thinking. Never sold, never shared.
        </p>

        <Link
          to="/subscribe"
          className="group"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: 360,
            paddingBottom: 16,
            borderBottom: '1px solid var(--color-rule-2)',
            transition: 'border-color 0.3s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderBottomColor = 'var(--color-oxblood)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderBottomColor = 'var(--color-rule-2)')
          }
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Subscribe
          </span>
          <span
            aria-hidden
            className="group-hover:translate-x-2"
            style={{
              color: 'var(--color-oxblood)',
              transition: 'transform 0.7s',
              display: 'inline-block',
            }}
          >
            →
          </span>
        </Link>
      </RevealStack>
    </Scene>
  )
}

/* ============================================================
   RevealStack — children fade-up in sequence as the scene enters
   ============================================================ */

function RevealStack({ children }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-20% 0px -20% 0px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.12 } },
      }}
    >
      {Array.isArray(children)
        ? children.map((child, i) => <RevealItem key={i}>{child}</RevealItem>)
        : <RevealItem>{children}</RevealItem>}
    </motion.div>
  )
}

function RevealItem({ children }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

/* ============================================================
   utilities
   ============================================================ */

function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatDate(d) {
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
