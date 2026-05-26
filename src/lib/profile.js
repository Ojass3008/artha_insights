// Reader profile — saved to Supabase + localStorage.
// Session flag controls whether orientation plays on this visit.

import { supabase } from './supabase'

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

export async function saveProfile(profile) {
  const completed = { ...profile, completedAt: new Date().toISOString() }

  // Always save locally so we have a fallback if the network fails
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(completed))
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* quota errors */
  }

  // Best-effort write to Supabase. Only insert if there's something to track.
  // We use the 'signups' table with a synthetic email key for orientation-only
  // entries (those without an email). When the user later subscribes, we'll
  // upsert by their real email.
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
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function isOrientedThisSession() {
  if (typeof window === 'undefined') return true
  return !!sessionStorage.getItem(SESSION_KEY)
}
