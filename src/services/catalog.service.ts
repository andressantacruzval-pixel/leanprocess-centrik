import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { ServiceResult } from './types'

export type CatalogItemRow = Database['public']['Tables']['catalog_items']['Row']
export type CatalogItemInsert = Database['public']['Tables']['catalog_items']['Insert']
export type CatalogItemUpdate = Database['public']['Tables']['catalog_items']['Update']

export type SipocSupplierRow = Database['public']['Tables']['sipoc_suppliers']['Row']
export type SipocSupplierInsert = Database['public']['Tables']['sipoc_suppliers']['Insert']
export type SipocCustomerRow = Database['public']['Tables']['sipoc_customers']['Row']
export type SipocCustomerInsert = Database['public']['Tables']['sipoc_customers']['Insert']
export type SipocEntryRow = Database['public']['Tables']['sipoc_entries']['Row']
export type SipocEntryInsert = Database['public']['Tables']['sipoc_entries']['Insert']

/**
 * Fetch catalog items for a company, optionally filtered by catalog_type.
 */
export async function getCatalogItems(
  companyId: string,
  catalogType?: string
): ServiceResult<CatalogItemRow[]> {
  try {
    let query = supabase
      .from('catalog_items')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (catalogType) {
      query = query.eq('catalog_type', catalogType)
    }

    const { data, error } = await query

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new catalog item.
 */
export async function createCatalogItem(data: CatalogItemInsert): ServiceResult<CatalogItemRow> {
  try {
    const { data: row, error } = await supabase
      .from('catalog_items')
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
 * Update an existing catalog item.
 */
export async function updateCatalogItem(
  id: string,
  updates: CatalogItemUpdate
): ServiceResult<CatalogItemRow> {
  try {
    const { data, error } = await supabase
      .from('catalog_items')
      .update(updates)
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
 * Delete a catalog item by ID.
 */
export async function deleteCatalogItem(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('catalog_items')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch SIPOC suppliers for a company.
 */
export async function getSipocSuppliers(companyId: string): ServiceResult<SipocSupplierRow[]> {
  try {
    const { data, error } = await supabase
      .from('sipoc_suppliers')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch SIPOC customers for a company.
 */
export async function getSipocCustomers(companyId: string): ServiceResult<SipocCustomerRow[]> {
  try {
    const { data, error } = await supabase
      .from('sipoc_customers')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new SIPOC supplier for a company.
 */
export async function createSipocSupplier(
  companyId: string,
  name: string,
  id?: string
): ServiceResult<SipocSupplierRow> {
  try {
    const { data, error } = await supabase
      .from('sipoc_suppliers')
      .insert({ id, company_id: companyId, name })
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new SIPOC customer for a company.
 */
export async function createSipocCustomer(
  companyId: string,
  name: string,
  id?: string
): ServiceResult<SipocCustomerRow> {
  try {
    const { data, error } = await supabase
      .from('sipoc_customers')
      .insert({ id, company_id: companyId, name })
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch all SIPOC entries for a given process.
 */
export async function getSipocEntries(processId: string): ServiceResult<SipocEntryRow[]> {
  try {
    const { data, error } = await supabase
      .from('sipoc_entries')
      .select('*')
      .eq('process_id', processId)
      .order('sort_order', { ascending: true })

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Replace all SIPOC entries for a process: delete existing, then insert new ones.
 */
export async function upsertSipocEntries(
  processId: string,
  entries: SipocEntryInsert[]
): ServiceResult<SipocEntryRow[]> {
  try {
    const { error: delError } = await supabase
      .from('sipoc_entries')
      .delete()
      .eq('process_id', processId)

    if (delError) return { data: null, error: new Error(delError.message) }

    if (entries.length === 0) return { data: [], error: null }

    const rows = entries.map((e) => ({ ...e, process_id: processId }))

    const { data, error } = await supabase
      .from('sipoc_entries')
      .insert(rows)
      .select()

    if (error) return { data: null, error: new Error(error.message) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
