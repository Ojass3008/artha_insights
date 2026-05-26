// Reader profile — saved permanently in localStorage so we can personalise.
// SESSION-only flag controls whether orientation plays this visit. Closing
// the tab clears the session flag, so a returning reader gets to see the
// orientation again — but their answers persist.

const PROFILE_KEY = 'artha_profile_v1'
const SESSION_KEY = 'artha_oriented_this_session'

export function getProfile() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ ...profile, completedAt: new Date().toISOString() })
    )
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* ignore quota errors */
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

// Has the reader completed orientation in THIS browser session?
// Used by App.jsx to decide whether to send them to /welcome.
export function isOrientedThisSession() {
  if (typeof window === 'undefined') return true
  return !!sessionStorage.getItem(SESSION_KEY)
}
