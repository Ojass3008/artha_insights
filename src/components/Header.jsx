import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // On home: transparent until scrolled
  // On subpages: solid paper bar
  const transparent = isHome && !scrolled

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        transparent
          ? 'bg-transparent border-transparent'
          : 'bg-[var(--color-paper)]/85 backdrop-blur-md border-b border-[var(--color-rule)]'
      }`}
    >
      <div className="mx-auto max-w-[1400px] px-8 md:px-14 h-16 flex items-center justify-between">
        <Link to="/" className="group flex items-baseline gap-2">
          <span
            className="text-[22px] tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
          >
            Artha
          </span>
          <span
            className="text-[9px] tracking-[0.32em] uppercase text-[var(--color-muted)] group-hover:text-[var(--color-oxblood)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Insights
          </span>
        </Link>

        <nav className="flex items-center gap-8">
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
      </div>
    </header>
  )
}
