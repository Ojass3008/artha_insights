import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Supabase env vars missing — features depending on the DB will be disabled.')
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false },
      })
    : null
