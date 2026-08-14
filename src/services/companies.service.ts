import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Table added in migration 20260414000001 - types will be available after next supabase gen types
export interface Company {
  id: string
  owner_id: string
  name: string
  slug: string | null
  logo_url: string | null
  industry: string | null
  country: string | null
  plan_id: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface CompanyCreateData {
  owner_id: string
  name: string
  slug?: string | null
  logo_url?: string | null
  industry?: string | null
  country?: string | null
  plan_id?: string | null
}

export type CompanyUpdateData = Omit<CompanyCreateData, 'owner_id'>

/**
 * Fetch all companies the user owns or belongs to via memberships.
 */
export async function getCompanies(userId: string): ServiceResult<Company[]> {
  try {
    // Fetch owned companies
    const { data: owned, error: ownedErr } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)

    if (ownedErr) return { data: null, error: new Error(ownedErr.message) }

    // Fetch companies via membership
    const { data: memberships, error: memErr } = await supabase
      .from('memberships')
      .select('company_id, companies(*)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('role', 'owner')

    if (memErr) return { data: null, error: new Error(memErr.message) }

    const memberCompanies: Company[] = (memberships ?? [])
      .map((m) => m.companies as unknown as Company)
      .filter(Boolean)

    // Deduplicate by id
    const all = [...(owned ?? []), ...memberCompanies]
    const unique = Array.from(new Map(all.map((c) => [c.id, c])).values())

    return { data: unique as unknown as Company[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Fetch a single company by ID.
 */
export async function getCompany(companyId: string): ServiceResult<Company> {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Company, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Create a new company and insert the owner membership record.
 */
export async function createCompany(data: CompanyCreateData): ServiceResult<Company> {
  try {
    // DB companies table uses user_id instead of owner_id; strip app-only fields (slug, plan_id)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { owner_id, slug, plan_id, ...rest } = data as CompanyCreateData & { slug?: string | null; plan_id?: string | null }
    const { data: company, error } = await supabase
      .from('companies')
      .insert({ ...rest, user_id: owner_id, onboarding_completed: false })
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }

    // Insert owner membership
    const { error: memErr } = await supabase
      .from('memberships')
      .insert({
        company_id: (company as unknown as Company).id,
        user_id: owner_id,
        role: 'owner',
        status: 'active',
        email: '',
      })

    if (memErr) return { data: null, error: new Error(memErr.message) }

    return { data: company as unknown as Company, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update an existing company's fields.
 */
export async function updateCompany(
  id: string,
  updates: Partial<CompanyUpdateData>
): ServiceResult<Company> {
  try {
    // Strip fields not present in DB schema (plan_id, slug are app-level only)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { plan_id, slug, ...dbUpdates } = updates as Record<string, unknown>
    const { data, error } = await supabase
      .from('companies')
      .update({ ...dbUpdates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Company, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Delete a company by ID.
 */
export async function deleteCompany(id: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Reinicia toda la información operativa de una empresa sin eliminarla.
 * Llama al RPC reset_company que verifica que el caller sea owner.
 */
export async function resetCompany(id: string): ServiceResult<void> {
  try {
    const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>)('reset_company', { p_company_id: id })
    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Mark onboarding as completed for a company.
 */
export async function completeOnboarding(companyId: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('companies')
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq('id', companyId)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
