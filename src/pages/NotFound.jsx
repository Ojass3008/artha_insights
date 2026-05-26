import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="w-full min-h-[calc(100vh-64px)] flex items-center">
      <section className="mx-auto w-full max-w-[600px] px-6 sm:px-10 lg:px-12 py-24 text-center">
        <div className="eyebrow mb-5">404</div>
        <h1
          className="text-[40px] md:text-[60px] leading-[1.05] tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}
        >
          That page does not <span className="serif-italic">exist</span>.
        </h1>
        <p className="text-[15px] text-[var(--color-muted)] mb-10">
          Either it was never written, or it was retired. Both are fine.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-3 px-6 py-3 bg-[var(--color-ink)] text-[var(--color-paper)] text-[12px] tracking-[0.18em] uppercase hover:bg-[var(--color-oxblood)] transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Back to Artha
          <span aria-hidden>→</span>
        </Link>
      </section>
    </div>
  )
}
