import { supabase } from '@/lib/supabase'
import type { ServiceResult } from './types'

// Table added in migration 20260414000001 - types will be available after next supabase gen types
export interface Membership {
  id: string
  company_id: string
  user_id: string | null
  email: string | null
  role: string
  status: 'pending' | 'active' | 'suspended'
  invited_by: string | null
  invited_at: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Fetch all members (memberships) for a given company.
 */
export async function getMembers(companyId: string): ServiceResult<Membership[]> {
  try {
    const { data, error } = await supabase
      .from('memberships')
      .select('*')
      .eq('company_id', companyId)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Membership[], error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Invite a new member to a company by email.
 */
export async function inviteMember(
  companyId: string,
  email: string,
  role: string,
  invitedBy: string
): ServiceResult<Membership> {
  try {
    const { data, error } = await supabase
      .from('memberships')
      .insert({
        company_id: companyId,
        email,
        role,
        invited_by: invitedBy,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return { data: null, error: new Error(error.message) }
    return { data: data as unknown as Membership, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Update the role of an existing membership.
 */
export async function updateMemberRole(membershipId: string, role: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('memberships')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', membershipId)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Remove a member from a company by deleting the membership record.
 */
export async function removeMember(membershipId: string): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('id', membershipId)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

/**
 * Accept a pending invitation by setting user_id and changing status to 'active'.
 */
export async function acceptInvitation(
  membershipId: string,
  userId: string
): ServiceResult<void> {
  try {
    const { error } = await supabase
      .from('memberships')
      .update({
        user_id: userId,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)

    if (error) return { data: null, error: new Error(error.message) }
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
