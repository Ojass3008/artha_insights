/**
 * PageWrap
 * --------------------------------------------
 * Single, guaranteed-centered shell used by every subpage.
 * Uses inline styles instead of Tailwind utilities so the
 * centering can't fail due to class purging or build issues.
 */
export default function PageWrap({
  children,
  maxWidth = 720,
  align = 'center', // 'center' | 'fill'
  vertical = false, // true = vertically center on screen
  padY = 96,
}) {
  const wrapStyle = vertical
    ? {
        width: '100%',
        minHeight: 'calc(100vh - var(--header-h))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 'clamp(20px, 5vw, 56px)',
        paddingRight: 'clamp(20px, 5vw, 56px)',
        paddingTop: padY,
        paddingBottom: padY,
      }
    : {
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        paddingLeft: 'clamp(20px, 5vw, 56px)',
        paddingRight: 'clamp(20px, 5vw, 56px)',
        paddingTop: padY,
        paddingBottom: padY,
      }

  const innerStyle = {
    width: '100%',
    maxWidth,
    textAlign: align === 'center' ? 'center' : 'left',
  }

  return (
    <section style={wrapStyle}>
      <div style={innerStyle}>{children}</div>
    </section>
  )
}
