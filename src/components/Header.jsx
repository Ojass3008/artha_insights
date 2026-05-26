import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV = [
  { to: '/today', label: 'Today' },
  { to: '/archive', label: 'Archive' },
  { to: '/about', label: 'About' },
  { to: '/subscribe', label: 'Subscribe' },
]

export default function Header() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while menu open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const transparent = isHome && !scrolled && !open

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          transparent
            ? 'bg-transparent border-transparent'
            : 'bg-[var(--color-paper)]/90 backdrop-blur-md border-b border-[var(--color-rule)]'
        }`}
      >
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 md:px-14 h-16 flex items-center justify-between">
          <Link to="/" className="group flex items-baseline gap-2 z-50 relative">
            <span
              className="text-[20px] sm:text-[22px] tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
            >
              Artha
            </span>
            <span
              className="text-[8px] sm:text-[9px] tracking-[0.32em] uppercase text-[var(--color-muted)] group-hover:text-[var(--color-oxblood)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Insights
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-[12px] tracking-[0.16em] uppercase transition-colors ${
                    isActive
                      ? 'text-[var(--color-oxblood)]'
                      : 'text-[var(--color-ink-2)] hover:text-[var(--color-oxblood)]'
                  }`
                }
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden z-50 relative w-10 h-10 flex flex-col items-end justify-center gap-[6px]"
            aria-label="Toggle menu"
          >
            <motion.span
              animate={{
                rotate: open ? 45 : 0,
                y: open ? 4 : 0,
                width: open ? 22 : 22,
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'block',
                height: 1,
                background: 'var(--color-ink)',
              }}
            />
            <motion.span
              animate={{
                rotate: open ? -45 : 0,
                y: open ? -3 : 0,
                width: open ? 22 : 14,
              }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'block',
                height: 1,
                background: 'var(--color-ink)',
              }}
            />
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden fixed inset-0 z-30"
            style={{ background: 'var(--color-paper)' }}
          >
            <nav className="h-full flex flex-col items-center justify-center gap-10 px-8">
              {NAV.map((item, i) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.1 + i * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <NavLink
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block transition-colors ${
                        isActive
                          ? 'text-[var(--color-oxblood)]'
                          : 'text-[var(--color-ink)]'
                      }`
                    }
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 400,
                      fontSize: 'clamp(36px, 9vw, 56px)',
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                    }}
                  >
                    {item.label}
                  </NavLink>
                </motion.div>
              ))}

              {/* Social links at the bottom */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="absolute bottom-12 flex items-center gap-8"
              >
                <a
                  href="https://www.instagram.com/artha.insights/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] tracking-[0.22em] uppercase text-[var(--color-muted)] hover:text-[var(--color-oxblood)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  Instagram
                </a>
                <a
                  href="https://www.linkedin.com/in/ojas-singh-496b67325/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] tracking-[0.22em] uppercase text-[var(--color-muted)] hover:text-[var(--color-oxblood)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  LinkedIn
                </a>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
