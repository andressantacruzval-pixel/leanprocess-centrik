import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Table added in migration 20260414000001 - types will be available after next supabase gen types
export interface Procedure {
  id: string
  process_id: string
  company_id: string
  objective: string | null
  scope: string | null
  definitions: string | null
  references: string | null
  version: string | null
  approved_by: string | null
  approval_date: string | null
  created_at: string
  updated_at: string
}

export interface ProcedureStep {
  id: string
  procedure_id: string
  step_number: number
  title: string
  description: string | null
  responsible: string | null
  duration_minutes: number | null
  inputs: string | null
  outputs: string | null
  observations: string | null
  created_at: string
}

export interface ProcedureWithSteps extends Procedure {
  steps: ProcedureStep[]
}

export interface ProcedureData {
  objective?: string | null
  scope?: string | null
  definitions?: string | null
  references?: string | null
  version?: string | null
  approved_by?: string | null
  approval_date?: string | null
}

export interface ProcedureStepData {
  step_number: number
  title: string
  description?: string | null
  responsible?: string | null
  duration_minutes?: number | null
  inputs?: string | null
  outputs?: string | null
  observations?: string | null
}

/**
 * Fetch the procedure for a process, including all steps ordered by step_number.
 */
export async function getProcedure(processId: string): ServiceResult<ProcedureWithSteps> {
  try {
    const { data, error } = await supabase
      .from('procedures')
      .select('*, steps:procedure_steps(*)')
      .eq('process_id', processId)
      .order('step_number', { foreignTable: 'procedure_steps', ascending: true })
      .maybeSingle()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as ProcedureWithSteps | null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Insert or update the procedure record for a process.
 * Acepta el documento completo (ProcedureData-like, campos en ES) y lo guarda
 * tanto en columnas discretas EN (las que tienen equivalente) como en data JSONB
 * para preservar estructura anidada (actividades, glosario, riesgos, sipoc).
 */
export async function upsertProcedure(
  processId: string,
  companyId: string,
  data: Record<string, unknown>
): ServiceResult<Procedure> {
  try {
    const { data: row, error } = await supabase
      .from('procedures')
      .upsert(
        {
          process_id: processId,
          company_id: companyId,
          title: (data.titulo as string | undefined) ?? null,
          objective: (data.objetivoGeneral as string | undefined) ?? null,
          scope: (data.alcance as string | undefined) ?? null,
          version: (data.version as string | undefined) ?? '1.0',
          data,
          updated_at: new Date().toISOString(),
        } as unknown as import('@/types/database').Database['public']['Tables']['procedures']['Insert'],
        { onConflict: 'process_id' }
      )
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as Procedure, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing procedure by ID.
 */
export async function updateProcedure(
  id: string,
  updates: Partial<ProcedureData>
): ServiceResult<Procedure> {
  try {
    const { data, error } = await supabase
      .from('procedures')
      .update(({ ...updates, updated_at: new Date().toISOString() }) as unknown as import('@/types/database').Database['public']['Tables']['procedures']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Procedure, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Replace all steps for a procedure: delete existing, then insert new ones.
 */
export async function upsertProcedureSteps(
  procedureId: string,
  steps: ProcedureStepData[]
): ServiceResult<ProcedureStep[]> {
  try {
    // Delete all existing steps
    const { error: delError } = await supabase
      .from('procedure_steps')
      .delete()
      .eq('procedure_id', procedureId)

    if (delError) return { data: null, error: new Error(delError.message) }

    if (steps.length === 0) return { data: [], error: null }

    const rows = steps.map((step) => ({ ...step, procedure_id: procedureId }))

    const { data, error } = await supabase
      .from('procedure_steps')
      .insert(rows as unknown as import('@/types/database').Database['public']['Tables']['procedure_steps']['Insert'][])
      .select()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as ProcedureStep[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
