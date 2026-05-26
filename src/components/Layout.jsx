import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* Always reserve space for the fixed header.
          The home page neutralizes this with `-mt-[var(--header-h)]`
          on its masthead so the watermark can flow under the
          transparent header bar. */}
      <main
        className="flex-1"
        style={{ paddingTop: 'var(--header-h)' }}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
