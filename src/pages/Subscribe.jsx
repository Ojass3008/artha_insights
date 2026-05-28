import { useState } from 'react'
import PageWrap from '../components/PageWrap'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/profile'

export default function Subscribe() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setStatus('loading')
    setErrorMsg('')

    // Always cache locally so we never lose a signup even if the DB call fails
    try {
      const list = JSON.parse(localStorage.getItem('artha_signups') || '[]')
      if (!list.includes(email)) list.push(email)
      localStorage.setItem('artha_signups', JSON.stringify(list))
    } catch {
      /* ignore */
    }

    // Best effort DB write
    if (supabase) {
      const profile = getProfile() || {}
      const { error } = await supabase.from('signups').insert({
        email: email.trim().toLowerCase(),
        source: 'subscribe',
        level: profile.level || null,
        interests: profile.interests || null,
        depth: profile.depth || null,
        name: profile.name || null,
      })

      if (error) {
        // Duplicate email (23505) = already subscribed = show success
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          setStatus('success')
          setEmail('')
          return
        }
        // RLS or other error — still show success to the user
        // (we have the email in localStorage as backup)
        console.warn('Supabase signup error:', error.message)
      }
    }

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
          fontSize: 'clamp(28px, 6vw, 48px)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          maxWidth: '14ch',
          margin: '0 auto 28px',
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
          fontSize: 'clamp(14px, 4vw, 16px)',
          lineHeight: 1.65,
          color: 'var(--color-ink-3)',
          maxWidth: '38ch',
          margin: '0 auto 40px',
          padding: '0 16px',
        }}
      >
        The week's writing — markets, startups, and capital from inside the
        machine.
      </p>

      {status === 'success' ? (
        <div
          style={{
            border: '1px solid var(--color-oxblood)',
            background: 'var(--color-oxblood-soft)',
            padding: '24px 24px',
            maxWidth: 420,
            margin: '0 auto',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 'clamp(15px, 4vw, 16px)',
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
            padding: '0 4px',
          }}
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            style={{
              flex: '1 1 220px',
              padding: '14px 16px',
              background: 'transparent',
              border: '1px solid var(--color-rule-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 16, // 16+ avoids iOS auto-zoom on focus
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
            disabled={status === 'loading'}
            style={{
              padding: '14px 24px',
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: status === 'loading' ? 'wait' : 'pointer',
              opacity: status === 'loading' ? 0.6 : 1,
              transition: 'background-color 0.25s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'var(--color-oxblood)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'var(--color-ink)')
            }
          >
            {status === 'loading' ? '…' : 'Subscribe'}
          </button>
        </form>
      )}

      {status === 'error' && errorMsg && (
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: 'var(--color-oxblood)',
          }}
        >
          {errorMsg}
        </p>
      )}

      <p
        style={{
          marginTop: 32,
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
