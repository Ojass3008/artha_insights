import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * SceneIndex
 * --------------------------------------------
 * A thin running-head in the right gutter showing the active scene.
 * Click any row to scroll to that section. Hidden on mobile.
 */
export default function SceneIndex({ scenes }) {
  const [active, setActive] = useState(scenes[0]?.id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersection ratio
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      {
        threshold: [0.3, 0.5, 0.7],
        rootMargin: '-25% 0px -25% 0px',
      }
    )
    scenes.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [scenes])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="Page sections"
      className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 z-30 flex-col gap-5 pointer-events-none"
    >
      {scenes.map((s, i) => {
        const isActive = active === s.id
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="pointer-events-auto group flex items-center gap-3 text-right"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: isActive
                ? 'var(--color-oxblood)'
                : 'var(--color-muted-2)',
              transition: 'color 0.4s ease',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span>
              {String(i + 1).padStart(2, '0')} · {s.label}
            </span>
            <motion.span
              animate={{
                width: isActive ? 28 : 12,
                background: isActive
                  ? 'var(--color-oxblood)'
                  : 'var(--color-muted-2)',
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: 1, display: 'inline-block' }}
            />
          </button>
        )
      })}
    </nav>
  )
}
