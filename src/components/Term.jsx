import { useState, useRef, useEffect } from 'react'
import { glossaryText } from '../lib/glossary'

/**
 * Term — an inline, dotted-underline word that reveals a plain-English
 * definition on hover (desktop) or tap (touch). Lets beginners learn jargon
 * without leaving the page; pros simply never trigger it.
 */
export default function Term({ k, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const text = glossaryText(k)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (!text) return <>{children}</>

  return (
    <span
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
      style={{
        position: 'relative',
        borderBottom: '1px dotted var(--color-muted)',
        cursor: 'help',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(280px, 78vw)',
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-sans)',
            fontSize: 12.5,
            lineHeight: 1.55,
            letterSpacing: 0,
            textTransform: 'none',
            whiteSpace: 'normal',
            padding: '10px 12px',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 50,
            textAlign: 'left',
            fontWeight: 400,
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
