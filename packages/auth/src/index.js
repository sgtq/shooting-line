import { createClient } from '@supabase/supabase-js'

export const APP_IDS = Object.freeze({
  manager: 'manager',
  ianseoDashboard: 'ianseo-dashboard',
  scorecard: 'scorecard',
})

export function createSupabaseClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  }

  return createClient(supabaseUrl, publishableKey)
}

export async function listAppAccess(client, userId) {
  const { data, error } = await client.from('app_access').select('app_id').eq('user_id', userId)

  if (error) return { data: [], error }
  return { data: data.map((grant) => grant.app_id), error: null }
}

export async function hasAppAccess(client, userId, appId) {
  const { data, error } = await client
    .from('app_access')
    .select('app_id')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .maybeSingle()

  if (error) return { allowed: false, error }
  return { allowed: data !== null, error: null }
}
