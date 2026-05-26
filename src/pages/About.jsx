import PageWrap from '../components/PageWrap'

export default function About() {
  return (
    <PageWrap maxWidth={620}>
      <div className="eyebrow mb-5">About</div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(28px, 5vw, 48px)',
          lineHeight: 1.14,
          letterSpacing: '-0.02em',
          maxWidth: '18ch',
          margin: '0 auto 56px',
          padding: '0 8px',
        }}
      >
        An <span className="serif-italic">eighteen-year-old</span> in
        Gurugram, building a quant model and reporting on Indian markets
        from the street.
      </h1>

      {/* Body — left-aligned within the centered column */}
      <div className="prose-artha" style={{ textAlign: 'left' }}>
        <p>
          Artha Insights is written and built by{' '}
          <strong>Ojas Singh</strong> — based in Gurugram, on a gap
          year, splitting his time between code and the camera. The
          code half is <strong>BharatAlpha</strong>, a Python factor
          model that screens Indian equities by quality, momentum, and
          liquidity-adjusted size. The other half walks the street:
          filming founders, sitting in on the rooms where capital
          actually moves, and asking better questions than the
          headlines do.
        </p>

        <p>Both halves feed one Sunday Brief.</p>

        <h2>Why it exists</h2>

        <p>
          Indian retail investing tripled between 2020 and 2024. The
          information layer did not. There is room for a publication
          that takes markets seriously, takes the reader seriously,
          and does not pretend to have certainty it has not earned.
          Artha is the thing you read on Sunday morning to think
          clearly for the week.
        </p>

        <h2>The promise</h2>

        <p>
          One Brief a week. Field notes when there is something real
          to report. Model snapshots when the data shifts. No tips,
          no targets, no certainty theatre.
        </p>

        <hr />

        <p>
          If any of this resonates, the simplest way in is the Sunday
          Brief.
        </p>
      </div>
    </PageWrap>
  )
}
