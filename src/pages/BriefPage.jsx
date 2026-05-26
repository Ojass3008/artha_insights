import { Link, useParams } from 'react-router-dom'
import { getBriefBySlug } from '../content/briefs'
import PageWrap from '../components/PageWrap'

export default function BriefPage() {
  const { slug } = useParams()
  const brief = getBriefBySlug(slug)

  if (!brief) {
    return (
      <PageWrap maxWidth={560} vertical>
        <div className="eyebrow mb-4">404</div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(36px, 5vw, 56px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginBottom: 24,
          }}
        >
          Not <span className="serif-italic">found</span>.
        </h1>
        <p style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 40 }}>
          That Brief does not exist (yet).
        </p>
        <Link
          to="/archive"
          style={{
            display: 'inline-block',
            paddingBottom: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            borderBottom: '1px solid var(--color-rule-2)',
            transition: 'all 0.2s',
          }}
        >
          Back to the Archive
        </Link>
      </PageWrap>
    )
  }

  return (
    <PageWrap maxWidth={680} padY={64}>
      {/* HEADER — centered */}
      <header style={{ marginBottom: 56 }}>
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
            marginBottom: 32,
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
            {formatDate(brief.date)}
          </span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'clamp(34px, 5vw, 60px)',
            lineHeight: 1.06,
            letterSpacing: '-0.02em',
            maxWidth: '18ch',
            margin: '0 auto 32px',
          }}
        >
          {brief.title}
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(17px, 1.8vw, 21px)',
            lineHeight: 1.55,
            color: 'var(--color-ink-3)',
            maxWidth: '48ch',
            margin: '0 auto',
          }}
        >
          {brief.dek}
        </p>

        <div
          style={{
            marginTop: 36,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
          }}
        >
          By Ojas Singh · {brief.readTime}
        </div>
      </header>

      {/* Hairline divider */}
      <div
        style={{
          height: 1,
          width: 80,
          background: 'var(--color-rule-2)',
          margin: '0 auto 56px',
        }}
      />

      {/* BODY — left-aligned within centered column */}
      <div className="prose-artha" style={{ textAlign: 'left' }}>
        {brief.body.map((block, i) => {
          if (block.type === 'h2') return <h2 key={i}>{block.text}</h2>
          if (block.type === 'h3') return <h3 key={i}>{block.text}</h3>
          if (block.type === 'quote')
            return <blockquote key={i}>{block.text}</blockquote>
          if (block.type === 'hr') return <hr key={i} />
          return <p key={i}>{block.text}</p>
        })}
      </div>

      {/* FOOTER CTA */}
      <div
        style={{
          marginTop: 80,
          paddingTop: 48,
          borderTop: '1px solid var(--color-rule)',
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: 'var(--color-muted)',
            marginBottom: 20,
          }}
        >
          The next Brief lands Sunday.
        </p>
        <Link
          to="/subscribe"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            transition: 'background 0.25s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = 'var(--color-oxblood)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = 'var(--color-ink)')
          }
        >
          Subscribe to receive it
          <span aria-hidden>→</span>
        </Link>
      </div>
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
