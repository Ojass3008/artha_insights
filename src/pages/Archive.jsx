import { Link } from 'react-router-dom'
import { useState } from 'react'
import { BRIEFS } from '../content/briefs'
import PageWrap from '../components/PageWrap'

const PILLARS = ['All', 'The Brief', 'The Street', 'The Model']

export default function Archive() {
  const [filter, setFilter] = useState('All')
  const items = BRIEFS.filter((b) => filter === 'All' || filter === 'The Brief')

  return (
    <PageWrap maxWidth={760}>
      <div className="eyebrow mb-5">Archive</div>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(34px, 5vw, 56px)',
          lineHeight: 1.08,
          letterSpacing: '-0.02em',
          maxWidth: '18ch',
          margin: '0 auto 56px',
        }}
      >
        Everything published,{' '}
        <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>
          by pillar.
        </span>
      </h1>

      {/* FILTER PILLS */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 64,
          paddingBottom: 24,
          borderBottom: '1px solid var(--color-rule)',
        }}
      >
        {PILLARS.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              transition: 'color 0.2s',
              background: filter === p ? 'var(--color-ink)' : 'transparent',
              color:
                filter === p ? 'var(--color-paper)' : 'var(--color-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* LIST */}
      {items.length === 0 ? (
        <p style={{ fontSize: 15, color: 'var(--color-muted)' }}>
          Nothing here yet. New work ships Sundays.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((b, idx) => (
            <li
              key={b.slug}
              style={{
                paddingBottom: 56,
                marginBottom: idx === items.length - 1 ? 0 : 56,
                borderBottom: '1px solid var(--color-rule)',
              }}
            >
              <Link
                to={`/brief/${b.slug}`}
                className="group"
                style={{ display: 'block', textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--color-oxblood)',
                    marginBottom: 16,
                  }}
                >
                  <span>The Brief</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 24,
                      height: 1,
                      background: 'var(--color-rule-2)',
                    }}
                  />
                  <span style={{ color: 'var(--color-muted)' }}>
                    {formatDate(b.date)}
                  </span>
                </div>

                <h2
                  className="group-hover:text-[var(--color-oxblood)] transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 'clamp(26px, 3.4vw, 36px)',
                    lineHeight: 1.12,
                    letterSpacing: '-0.02em',
                    maxWidth: '18ch',
                    margin: '0 auto 20px',
                  }}
                >
                  {b.title}
                </h2>

                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    fontSize: 'clamp(15px, 1.4vw, 17px)',
                    lineHeight: 1.6,
                    color: 'var(--color-ink-3)',
                    maxWidth: '52ch',
                    margin: '0 auto',
                  }}
                >
                  {b.dek}
                </p>

                <div
                  style={{
                    marginTop: 24,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 12,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'var(--color-muted)',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 32,
                        height: 1,
                        background: 'currentColor',
                      }}
                    />
                    Read · {b.readTime}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageWrap>
  )
}

function formatDate(d) {
  const date = new Date(d)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
