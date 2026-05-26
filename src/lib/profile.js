// Reader profile — saved permanently in localStorage so we never gate
// the same device twice. The actual answers go to Supabase too.

import { supabase } from './supabase'

const PROFILE_KEY = 'artha_profile_v1'

export function getProfile() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveProfile(profile) {
  const completed = { ...profile, completedAt: new Date().toISOString() }

  // Persist locally first — this is what determines whether orientation
  // shows on the next visit. We never want a network failure to leave
  // the user without a profile.
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(completed))
  } catch {
    /* quota errors */
  }

  // Best-effort write to Supabase for our own analytics later.
  if (!supabase) return

  try {
    const syntheticEmail =
      profile.email ||
      `orientation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@artha.local`

    await supabase.from('signups').insert({
      email: syntheticEmail,
      source: 'orientation',
      level: profile.level || null,
      interests: profile.interests || null,
      depth: profile.depth || null,
      name: profile.name || null,
    })
  } catch {
    /* silent — orientation should never block the user */
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY)
  } catch {
    /* ignore */
  }
}

// Has the reader completed orientation on this device?
// Once true, it stays true forever (until they clear localStorage).
export function hasCompletedOrientation() {
  if (typeof window === 'undefined') return true
  return !!getProfile()
}
