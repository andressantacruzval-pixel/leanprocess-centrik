import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Table added in migration 20260414000001 - types will be available after next supabase gen types
export interface ChangeLogEntry {
  id: string
  process_id: string
  company_id: string
  user_id: string
  action: string
  description: string
  author_name: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ChangeLogEntryData {
  process_id: string
  company_id: string
  user_id: string
  action: string
  description: string
  author_name: string
  metadata?: Record<string, unknown>
}

/**
 * Insert a new change log entry for a process.
 */
export async function addEntry(data: ChangeLogEntryData): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('change_log')
      .insert({
        process_id: data.process_id,
        company_id: data.company_id,
        user_id: data.user_id,
        action: data.action,
        description: data.description,
        author_name: data.author_name,
        metadata: (data.metadata ?? null) as import('@/types/database').Database['public']['Tables']['change_log']['Insert']['metadata'],
      })

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch change log entries for a process, most recent first.
 */
export async function getEntries(
  processId: string,
  limit = 50
): ServiceResult<ChangeLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('change_log')
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as ChangeLogEntry[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
