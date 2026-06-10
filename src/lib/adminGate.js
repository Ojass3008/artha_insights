// Lightweight client-side gate for the internal allocator view.
//
// This is NOT real security — it just keeps the experimental allocator page
// out of casual public view. The data behind it (meta_weights etc.) is
// already public-read in Supabase, so treat this as a "soft" gate, not auth.
// For true protection you'd move the read behind an authenticated API.
//
// The passphrase is compared against VITE_ALLOCATOR_KEY (set in Vercel env).
// If that env var is unset, the gate is OPEN (handy for local dev).

const UNLOCK_KEY = 'artha_allocator_unlocked_v1'

export function allocatorRequiresKey() {
  return Boolean(import.meta.env.VITE_ALLOCATOR_KEY)
}

export function isAllocatorUnlocked() {
  if (!allocatorRequiresKey()) return true
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function tryUnlockAllocator(passphrase) {
  const expected = import.meta.env.VITE_ALLOCATOR_KEY
  if (!expected) return true // no key configured -> open
  const ok = passphrase === expected
  if (ok) {
    try {
      localStorage.setItem(UNLOCK_KEY, '1')
    } catch {
      /* ignore quota */
    }
  }
  return ok
}

export function lockAllocator() {
  try {
    localStorage.removeItem(UNLOCK_KEY)
  } catch {
    /* ignore */
  }
}
