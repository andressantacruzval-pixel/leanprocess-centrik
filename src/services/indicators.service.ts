import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Table added in migration 20260414000001 - types will be available after next supabase gen types
export interface Indicator {
  id: string
  company_id: string
  process_id: string | null
  name: string
  description: string | null
  unit: string | null
  frequency: string | null
  target_value: number | null
  min_value: number | null
  max_value: number | null
  responsible: string | null
  formula: string | null
  data_source: string | null
  created_at: string
  updated_at: string
}

export interface IndicatorReading {
  id: string
  indicator_id: string
  value: number
  period: string
  notes: string | null
  recorded_at: string
  created_at: string
}

export interface IndicatorCreateData {
  company_id: string
  process_id?: string | null
  name: string
  description?: string | null
  unit?: string | null
  frequency?: string | null
  target_value?: number | null
  min_value?: number | null
  max_value?: number | null
  responsible?: string | null
  formula?: string | null
  data_source?: string | null
}

/**
 * Fetch all indicators for a company, optionally filtered by process.
 */
export async function getIndicators(
  companyId: string,
  processId?: string
): ServiceResult<Indicator[]> {
  try {
    let query = supabase
      .from('indicators')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (processId) {
      query = query.eq('process_id', processId)
    }

    const { data, error } = await query

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Indicator[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new indicator.
 */
export async function createIndicator(data: IndicatorCreateData): ServiceResult<Indicator> {
  try {
    const { data: row, error } = await supabase
      .from('indicators')
      .insert(data as unknown as import('@/types/database').Database['public']['Tables']['indicators']['Insert'])
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as Indicator, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing indicator.
 */
export async function updateIndicator(
  id: string,
  updates: Partial<IndicatorCreateData>
): ServiceResult<Indicator> {
  try {
    const { data, error } = await supabase
      .from('indicators')
      .update(({ ...updates, updated_at: new Date().toISOString() }) as unknown as import('@/types/database').Database['public']['Tables']['indicators']['Update'])
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Indicator, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete an indicator by ID.
 */
export async function deleteIndicator(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('indicators')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Add a reading (measurement) to an indicator.
 */
export async function addReading(
  indicatorId: string,
  data: { value: number; period: string; notes?: string }
): ServiceResult<IndicatorReading> {
  try {
    const { data: row, error } = await supabase
      .from('indicator_readings')
      .insert({
        indicator_id: indicatorId,
        value: data.value,
        period: data.period,
        notes: data.notes ?? null,
      })
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as IndicatorReading, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch all readings for a given indicator.
 */
export async function getReadings(indicatorId: string): ServiceResult<IndicatorReading[]> {
  try {
    const { data, error } = await supabase
      .from('indicator_readings')
      .select('*')
      .eq('indicator_id', indicatorId)
      .order('period', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as IndicatorReading[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
