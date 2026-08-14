/**
 * Workspace / membership domain types
 * -----------------------------------
 * Una "empresa" en la UI equivale a un workspace aislado. Todo el contenido
 * del usuario (procesos, indicadores, SIPOC, org, procedimientos...) vive
 * dentro de un workspace y se filtra por company_id.
 *
 * Estos tipos abstraen el concepto para que el resto del codigo pueda
 * razonar en terminos de membresia/rol sin acoplarse a un proveedor
 * especifico de auth.
 */

/**
 * Rol de un usuario dentro de una empresa. El owner siempre es el que
 * contrato el plan. Los demas son invitados (cobran como extra_member).
 */
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

export type MembershipStatus = 'active' | 'invited' | 'suspended' | 'revoked'

export interface Membership {
  id: string
  company_id: string
  /** user_id del miembro si ya tiene cuenta. null mientras esta invitado. */
  user_id: string | null
  email: string
  full_name?: string | null
  role: WorkspaceRole
  status: MembershipStatus
  /** True si este miembro esta cubierto por add-on (extra_member) vs incluido en el plan base. */
  billed_as_addon: boolean
  invited_at: string
  accepted_at?: string | null
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  company_id: string
  email: string
  role: WorkspaceRole
  token: string
  expires_at: string
  created_by_user_id: string
  created_at: string
}

/**
 * Preferencias/estado especifico de un workspace. Sirve para decidir
 * que empresa esta "activa" cuando el usuario navega entre multiples.
 */
export interface WorkspaceContext {
  active_company_id: string | null
  last_visited: Record<string, string> // companyId -> ISO date
}
