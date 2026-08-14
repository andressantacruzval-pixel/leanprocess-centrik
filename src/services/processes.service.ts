import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { ServiceResult } from './types'

export type MacroprocessRow = Database['public']['Tables']['macroprocesses']['Row']
export type MacroprocessInsert = Database['public']['Tables']['macroprocesses']['Insert']
export type MacroprocessUpdate = Database['public']['Tables']['macroprocesses']['Update']

export type ProcessRow = Database['public']['Tables']['processes']['Row']
export type ProcessInsert = Database['public']['Tables']['processes']['Insert']
export type ProcessUpdate = Database['public']['Tables']['processes']['Update']

/**
 * Fetch all macroprocesses for a company (via user_id / company_id field).
 */
export async function getMacroprocesses(companyId: string): ServiceResult<MacroprocessRow[]> {
  try {
    const { data, error } = await supabase
      .from('macroprocesses')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch all processes for a company (via user_id / company_id field).
 */
export async function getProcesses(companyId: string): ServiceResult<ProcessRow[]> {
  try {
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch a single process by ID.
 */
export async function getProcess(processId: string): ServiceResult<ProcessRow> {
  try {
    const { data, error } = await supabase
      .from('processes')
      .select('*')
      .eq('id', processId)
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new macroprocess.
 */
export async function createMacroprocess(
  data: MacroprocessInsert
): ServiceResult<MacroprocessRow> {
  try {
    const { data: row, error } = await supabase
      .from('macroprocesses')
      .insert(data)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing macroprocess.
 */
export async function updateMacroprocess(
  id: string,
  updates: MacroprocessUpdate
): ServiceResult<MacroprocessRow> {
  try {
    const { data, error } = await supabase
      .from('macroprocesses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete a macroprocess by ID.
 */
export async function deleteMacroprocess(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('macroprocesses')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new process.
 */
export async function createProcess(data: ProcessInsert): ServiceResult<ProcessRow> {
  try {
    const { data: row, error } = await supabase
      .from('processes')
      .insert(data)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing process.
 */
export async function updateProcess(
  id: string,
  updates: ProcessUpdate
): ServiceResult<ProcessRow> {
  try {
    const { data, error } = await supabase
      .from('processes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete a process by ID.
 */
export async function deleteProcess(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('processes')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Reorder macroprocesses by updating each record's sort_order individually.
 */
export async function reorderMacroprocesses(
  updates: Array<{ id: string; sort_order: number }>
): ServiceResult<void> {
  try {
    await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from('macroprocesses').update({ sort_order }).eq('id', id)
      )
    )
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Reorder processes by updating each record's sort_order individually.
 */
export async function reorderProcesses(
  updates: Array<{ id: string; sort_order: number }>
): ServiceResult<void> {
  try {
    await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from('processes').update({ sort_order }).eq('id', id)
      )
    )
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
