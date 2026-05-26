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
import { hasCompletedOrientation } from './lib/profile'

/**
 * FirstVisitGate
 * ---------------
 * On first visit on this device → /welcome.
 * Once orientation is completed (saved in localStorage), the gate is
 * permanently disabled for this device. Refreshing or revisiting any
 * page never re-shows the orientation.
 */
function FirstVisitGate({ children }) {
  const { pathname } = useLocation()
  if (pathname === '/' && !hasCompletedOrientation()) {
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
            <FirstVisitGate>
              <Home />
            </FirstVisitGate>
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
