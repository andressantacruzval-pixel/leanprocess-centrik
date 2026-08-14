import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { ServiceResult } from './types'

export type ProfileRow = Database['public']['Tables']['profiles']['Row']

/**
 * Sign in with email and password.
 * Returns the user's UUID on success.
 */
export async function signIn(
  email: string,
  password: string
): ServiceResult<{ userId: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { data: null, error: new Error(error.message) }
    return { data: { userId: data.user.id }, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Register a new user. Returns userId and whether email confirmation is needed.
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string
): ServiceResult<{ userId: string; needsConfirmation: boolean }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { data: null, error: new Error(error.message) }
    if (!data.user) return { data: null, error: new Error('No se pudo crear el usuario') }
    return {
      data: {
        userId: data.user.id,
        needsConfirmation: !data.session,
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * Send a password reset email with a redirect back to /reset-password.
 */
export async function resetPasswordRequest(email: string): ServiceResult<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update the authenticated user's password.
 */
export async function updatePassword(newPassword: string): ServiceResult<void> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update the current user's profile row (full_name, avatar_url).
 */
export async function updateProfile(updates: {
  full_name?: string
  avatar_url?: string
}): ServiceResult<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: new Error('No hay sesión activa') }

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch a user's profile by their UUID.
 */
export async function getProfile(userId: string): ServiceResult<ProfileRow> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Return the currently authenticated Supabase user, or null if not signed in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
