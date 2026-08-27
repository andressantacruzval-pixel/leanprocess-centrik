import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Application, ApplicationUsage } from '@/types/application'
import type { ServiceResult } from './types'

type AppInsert = Database['public']['Tables']['applications']['Insert']
type AppUpdate = Database['public']['Tables']['applications']['Update']
type UsageInsert = Database['public']['Tables']['application_usages']['Insert']
type UsageUpdate = Database['public']['Tables']['application_usages']['Update']

export async function getApplicationsByCompany(companyId: string): ServiceResult<Application[]> {
  try {
    const { data, error } = await supabase.from('applications').select('*').eq('company_id', companyId).order('created_at', { ascending: true })
    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Application[], error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function createApplication(data: Partial<Application>): ServiceResult<Application> {
  try {
    const { data: row, error } = await supabase.from('applications').insert(data as unknown as AppInsert).select().single()
    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as Application, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function updateApplication(id: string, updates: Partial<Application>): ServiceResult<Application> {
  try {
    const { data, error } = await supabase.from('applications').update({ ...updates, updated_at: new Date().toISOString() } as unknown as AppUpdate).eq('id', id).select().single()
    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Application, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function deleteApplication(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase.from('applications').delete().eq('id', id)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

// ── Usos de la aplicación por actividad/proceso ────────────────────────────
export async function getUsagesByCompany(companyId: string): ServiceResult<ApplicationUsage[]> {
  try {
    const { data, error } = await supabase.from('application_usages').select('*').eq('company_id', companyId)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as ApplicationUsage[], error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function createUsage(data: Partial<ApplicationUsage>): ServiceResult<ApplicationUsage> {
  try {
    const { data: row, error } = await supabase.from('application_usages').insert(data as unknown as UsageInsert).select().single()
    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as ApplicationUsage, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function updateUsage(id: string, updates: Partial<ApplicationUsage>): ServiceResult<void> {
  try {
    const { error } = await supabase.from('application_usages').update({ ...updates, updated_at: new Date().toISOString() } as unknown as UsageUpdate).eq('id', id)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function deleteUsageById(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase.from('application_usages').delete().eq('id', id)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}

export async function deleteUsagesForApplication(applicationId: string): ServiceResult<void> {
  try {
    const { error } = await supabase.from('application_usages').delete().eq('application_id', applicationId)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) } }
}
