import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Archive from './pages/Archive'
import BriefPage from './pages/BriefPage'
import Subscribe from './pages/Subscribe'
import Today from './pages/Today'
import NotFound from './pages/NotFound'
import Welcome from './pages/Welcome'
import { isOrientedThisSession } from './lib/profile'

/**
 * SessionGate
 * --------------
 * On every fresh browser session, the home redirects to /welcome.
 * Once the reader finishes orientation (or skips it), they go to home and
 * stay there for the rest of the session. Closing the tab resets, so the
 * orientation is part of every visit — but their answers persist.
 *
 * Subpages (/about, /brief/*, etc.) are never gated, so shared links work.
 */
function SessionGate({ children }) {
  const { pathname } = useLocation()
  if (pathname === '/' && !isOrientedThisSession()) {
    return <Navigate to="/welcome" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Orientation is its own full-viewport route — no Layout shell. */}
      <Route path="/welcome" element={<Welcome />} />

      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <SessionGate>
              <Home />
            </SessionGate>
          }
        />
        <Route path="/about" element={<About />} />
        <Route path="/today" element={<Today />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/brief/:slug" element={<BriefPage />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
