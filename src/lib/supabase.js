import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Only create the client if both values look valid
const isValid = url.startsWith('https://') && anonKey.length > 20

if (!isValid) {
  console.warn(
    'Supabase env vars missing or invalid — DB features disabled. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
  )
}

export const supabase = isValid
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null
