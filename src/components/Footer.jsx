import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-[var(--color-rule)] bg-[var(--color-paper)]">
      <div className="mx-auto max-w-[1100px] px-8 md:px-14 py-20 grid gap-14 md:grid-cols-12">
        <div className="md:col-span-6">
          <div
            className="text-[28px] tracking-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}
          >
            Artha Insights
          </div>
          <p className="mt-3 text-[14px] text-[var(--color-muted)] max-w-[36ch] leading-[1.65]">
            Markets and money the way a builder sees them, not the way a broker
            sells them.
          </p>
        </div>

        <div className="md:col-span-3">
          <div className="eyebrow mb-5">Read</div>
          <ul className="space-y-3 text-[14px] text-[var(--color-ink-3)]">
            <li>
              <Link to="/today" className="hover:text-[var(--color-oxblood)] transition-colors">
                Today
              </Link>
            </li>
            <li>
              <Link to="/archive" className="hover:text-[var(--color-oxblood)] transition-colors">
                Archive
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-[var(--color-oxblood)] transition-colors">
                About
              </Link>
            </li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <div className="eyebrow mb-5">Elsewhere</div>
          <ul className="space-y-3 text-[14px] text-[var(--color-ink-3)]">
            <li>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--color-oxblood)] transition-colors"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--color-oxblood)] transition-colors"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <Link to="/subscribe" className="hover:text-[var(--color-oxblood)] transition-colors">
                Newsletter
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--color-rule)]">
        <div className="mx-auto max-w-[1100px] px-8 md:px-14 py-6 flex items-center justify-between flex-wrap gap-3">
          <p
            className="text-[10px] tracking-[0.32em] uppercase text-[var(--color-muted-2)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            © {year} Artha Insights · Built in Gurgaon
          </p>
          <p
            className="text-[10px] tracking-[0.32em] uppercase text-[var(--color-muted-2)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Editorial only · Not investment advice
          </p>
        </div>
      </div>
    </footer>
  )
}
