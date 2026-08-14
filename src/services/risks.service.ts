import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Table added in migration 20260414000001 - types will be available after next supabase gen types
export interface Risk {
  id: string
  process_id: string
  company_id: string
  name: string
  description: string | null
  category: string | null
  probability: number | null
  impact: number | null
  risk_level: string | null
  status: string | null
  owner: string | null
  created_at: string
  updated_at: string
}

export interface Control {
  id: string
  risk_id: string
  name: string
  description: string | null
  control_type: string | null
  effectiveness: string | null
  frequency: string | null
  responsible: string | null
  created_at: string
  updated_at: string
}

export interface RiskWithControls extends Risk {
  controls: Control[]
}

export interface RiskCreateData {
  process_id: string
  company_id: string
  name: string
  description?: string | null
  category?: string | null
  probability?: number | null
  impact?: number | null
  risk_level?: string | null
  status?: string | null
  owner?: string | null
}

export interface ControlCreateData {
  risk_id: string
  name: string
  description?: string | null
  control_type?: string | null
  effectiveness?: string | null
  frequency?: string | null
  responsible?: string | null
}

/**
 * Fetch all risks with their controls for a given process.
 */
export async function getRisksByProcess(processId: string): ServiceResult<RiskWithControls[]> {
  try {
    const { data, error } = await supabase
      .from('risks')
      .select('*, controls:risk_controls(*)')
      .eq('process_id', processId)
      .order('created_at', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as RiskWithControls[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch all risks with their controls for an entire company.
 */
export async function getRisksByCompany(companyId: string): ServiceResult<RiskWithControls[]> {
  try {
    const { data, error } = await supabase
      .from('risks')
      .select('*, controls:risk_controls(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as RiskWithControls[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new risk record.
 */
export async function createRisk(data: RiskCreateData): ServiceResult<Risk> {
  try {
    const { data: row, error } = await supabase
      .from('risks')
      .insert(data as unknown as import('@/types/database').Database['public']['Tables']['risks']['Insert'])
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as Risk, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing risk.
 */
export async function updateRisk(
  id: string,
  updates: Partial<RiskCreateData>
): ServiceResult<Risk> {
  try {
    const { data, error } = await supabase
      .from('risks')
      .update(({ ...updates, updated_at: new Date().toISOString() }) as unknown as import('@/types/database').Database['public']['Tables']['risks']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Risk, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete a risk by ID.
 */
export async function deleteRisk(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('risks')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete multiple risks by their IDs.
 */
export async function bulkDeleteRisks(ids: string[]): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('risks')
      .delete()
      .in('id', ids)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a control linked to a risk.
 */
export async function createControl(
  riskId: string,
  data: ControlCreateData
): ServiceResult<Control> {
  try {
    const { bpmnElementId: _bpmn, ...dbData } = data as unknown as Record<string, unknown>
    const { data: row, error } = await supabase
      .from('risk_controls')
      .insert(({ ...dbData, risk_id: riskId }) as unknown as import('@/types/database').Database['public']['Tables']['risk_controls']['Insert'])
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as Control, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing control.
 */
export async function updateControl(
  id: string,
  updates: Partial<ControlCreateData>
): ServiceResult<Control> {
  try {
    const { id: _id, bpmnElementId: _bpmn, ...dbUpdates } = updates as Record<string, unknown>
    const { data, error } = await supabase
      .from('risk_controls')
      .update(({ ...dbUpdates, updated_at: new Date().toISOString() }) as unknown as import('@/types/database').Database['public']['Tables']['risk_controls']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Control, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete a control by ID.
 */
export async function deleteControl(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('risk_controls')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Import AI-generated risk items in bulk for a process.
 */
export async function importAiRisks(
  processId: string,
  companyId: string,
  items: Partial<Risk>[]
): ServiceResult<Risk[]> {
  try {
    const rows = items.map((item) => ({
      ...item,
      process_id: processId,
      company_id: companyId,
    }))

    const { data, error } = await supabase
      .from('risks')
      .insert(rows as unknown as import('@/types/database').Database['public']['Tables']['risks']['Insert'][])
      .select()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Risk[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
