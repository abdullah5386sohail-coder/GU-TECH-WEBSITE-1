import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

export const isConfigured = Boolean(url && anon && !url.includes('YOUR_PROJECT'))
export const adminDb: SupabaseClient | null = url && serviceRole && !url.includes('YOUR_PROJECT')
  ? createClient(url!, serviceRole!, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

export function userDb(token: string): SupabaseClient {
  if (!url || !anon) throw new Error('Supabase API credentials are not configured.')
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'lms-private'
