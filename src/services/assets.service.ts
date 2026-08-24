import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { InformationAsset } from '@/types/asset'
import type { ServiceResult } from './types'

type AssetInsert = Database['public']['Tables']['information_assets']['Insert']
type AssetUpdate = Database['public']['Tables']['information_assets']['Update']

export async function getAssetsByCompany(companyId: string): ServiceResult<InformationAsset[]> {
  try {
    const { data, error } = await supabase
      .from('information_assets')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as InformationAsset[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function createAsset(data: Partial<InformationAsset>): ServiceResult<InformationAsset> {
  try {
    const { data: row, error } = await supabase
      .from('information_assets')
      .insert(data as unknown as AssetInsert)
      .select()
      .single()
    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as InformationAsset, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function updateAsset(id: string, updates: Partial<InformationAsset>): ServiceResult<InformationAsset> {
  try {
    const { data, error } = await supabase
      .from('information_assets')
      .update({ ...updates, updated_at: new Date().toISOString() } as unknown as AssetUpdate)
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as InformationAsset, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function deleteAsset(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase.from('information_assets').delete().eq('id', id)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

// ── Operaciones sobre el activo (trazabilidad / Data Journey) ──────────────
type OperationInsert = Database['public']['Tables']['asset_operations']['Insert']

export interface AssetOperationRow {
  id: string
  company_id: string
  asset_id: string
  process_id: string | null
  operation: string
  source_process_id: string | null
  target_process_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export async function getOperationsByCompany(companyId: string): ServiceResult<AssetOperationRow[]> {
  try {
    const { data, error } = await supabase
      .from('asset_operations')
      .select('*')
      .eq('company_id', companyId)
    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as AssetOperationRow[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function createOperation(data: Partial<AssetOperationRow>): ServiceResult<AssetOperationRow> {
  try {
    const { data: row, error } = await supabase
      .from('asset_operations')
      .insert(data as unknown as OperationInsert)
      .select()
      .single()
    if (error) return { data: null, error: new Error(error.message) }
    return { data: row as unknown as AssetOperationRow, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

// Reemplaza SOLO la operación de ciclo de vida (filas sin origen/destino) de un
// activo en un proceso. No toca los enlaces de trazabilidad (va a / viene de).
export async function replaceOperationForAssetProcess(assetId: string, processId: string | null): ServiceResult<void> {
  try {
    let q = supabase.from('asset_operations').delete()
      .eq('asset_id', assetId).is('source_process_id', null).is('target_process_id', null)
    q = processId ? q.eq('process_id', processId) : q.is('process_id', null)
    const { error } = await q
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

// Reemplaza los enlaces de trazabilidad (Data Journey) de un activo en un proceso:
// 'to' = procesos a los que va (target_process_id), 'from' = de los que viene
// (source_process_id).
export async function replaceJourneyLinks(assetId: string, processId: string | null, direction: 'to' | 'from'): ServiceResult<void> {
  try {
    let q = supabase.from('asset_operations').delete().eq('asset_id', assetId)
      .not(direction === 'to' ? 'target_process_id' : 'source_process_id', 'is', null)
    q = processId ? q.eq('process_id', processId) : q.is('process_id', null)
    const { error } = await q
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
