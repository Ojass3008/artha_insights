import { useState } from 'react'
import PageWrap from '../components/PageWrap'

export default function Subscribe() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    const list = JSON.parse(localStorage.getItem('artha_signups') || '[]')
    if (!list.includes(email)) list.push(email)
    localStorage.setItem('artha_signups', JSON.stringify(list))
    setStatus('success')
    setEmail('')
  }

  return (
    <PageWrap maxWidth={540} vertical padY={48}>
      <div className="eyebrow mb-5">Subscribe</div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(32px, 4.6vw, 48px)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          maxWidth: '14ch',
          margin: '0 auto 32px',
        }}
      >
        One{' '}
        <span className="serif-italic" style={{ color: 'var(--color-oxblood)' }}>
          Brief
        </span>{' '}
        in your inbox.
        <br />
        Every Sunday.
      </h1>

      <p
        style={{
          fontSize: 16,
          lineHeight: 1.65,
          color: 'var(--color-ink-3)',
          maxWidth: '40ch',
          margin: '0 auto 48px',
        }}
      >
        The week's writing — markets, startups, and capital from inside
        the machine.
      </p>

      {status === 'success' ? (
        <div
          style={{
            border: '1px solid var(--color-oxblood)',
            background: 'var(--color-oxblood-soft)',
            padding: '32px',
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--color-ink)',
            }}
          >
            You're on the list. The next Brief lands Sunday.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              flex: '1 1 220px',
              padding: '14px 16px',
              background: 'transparent',
              border: '1px solid var(--color-rule-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = 'var(--color-oxblood)')
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'var(--color-rule-2)')
            }
          />
          <button
            type="submit"
            style={{
              padding: '14px 24px',
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.25s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--color-oxblood)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'var(--color-ink)')
            }
          >
            Subscribe
          </button>
        </form>
      )}

      <p
        style={{
          marginTop: 40,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          color: 'var(--color-muted-2)',
        }}
      >
        Free · Unsubscribe in one click · Never shared
      </p>
    </PageWrap>
  )
}
