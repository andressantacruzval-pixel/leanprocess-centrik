/**
 * membershipStore
 * ---------------
 * Gestiona miembros invitados por empresa. Cada empresa incluye al owner
 * (no cobrable). Los demas se modelan como `Membership` y disparan un
 * add-on extra_member cuando se cobra.
 *
 * La API se mantiene simetrica con `workspaceStore.createCompany`:
 *  - `inviteMember(...)` devuelve un BillingGate. Si requiere pago,
 *    NO crea nada. El UI decide si cobrar y luego llama
 *    `confirmInviteMember(...)` para materializar.
 *  - `confirmInviteMember(...)` registra la membership + el add-on
 *    extra_member en workspaceStore.
 *
 * Esto deja preparado el camino para integrar emails reales y Stripe.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Invitation,
  Membership,
  MembershipStatus,
  WorkspaceRole,
} from '@/types/workspace'
import type { BillingGate } from '@/types/billing'
import { ADDON_PRICES, CURRENCY, evaluateInviteMember } from '@/lib/pricing'
import { useWorkspaceStore } from './workspaceStore'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

export interface InviteMemberDraft {
  email: string
  full_name?: string
  role: WorkspaceRole
}

export interface InviteMemberResult {
  gate: BillingGate
  membership?: Membership
}

interface MembershipState {
  memberships: Membership[]
  invitations: Invitation[]

  // ─── Owner bootstrap ────────────────────────────────────────────────
  /** Registra al owner como primer miembro de la empresa. */
  ensureOwner: (
    companyId: string,
    userId: string,
    email: string,
    fullName?: string | null
  ) => void

  // ─── Queries ───────────────────────────────────────────────────────
  getByCompany: (companyId: string) => Membership[]
  getMemberCount: (companyId: string) => number
  canInviteGate: (companyId: string) => BillingGate

  // ─── CRUD ──────────────────────────────────────────────────────────
  inviteMember: (
    companyId: string,
    draft: InviteMemberDraft,
    ownerUserId: string
  ) => InviteMemberResult
  confirmInviteMember: (
    companyId: string,
    draft: InviteMemberDraft,
    ownerUserId: string,
    paymentRef?: string
  ) => Membership
  updateMembership: (id: string, updates: Partial<Membership>) => void
  removeMember: (id: string) => void

  // ─── Reset ─────────────────────────────────────────────────────────
  resetAll: () => void

  // ─── DB sync ───────────────────────────────────────────────────────
  loadFromDB: (companyId: string) => Promise<void>
}

function makeMembership(
  companyId: string,
  draft: InviteMemberDraft,
  opts: { status: MembershipStatus; billedAsAddon: boolean; userId?: string | null }
): Membership {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    company_id: companyId,
    user_id: opts.userId ?? null,
    email: draft.email,
    full_name: draft.full_name ?? null,
    role: draft.role,
    status: opts.status,
    billed_as_addon: opts.billedAsAddon,
    invited_at: now,
    accepted_at: opts.status === 'active' ? now : null,
    created_at: now,
    updated_at: now,
  }
}

export const useMembershipStore = create<MembershipState>()(
  persist(
    (set, get) => ({
      memberships: [],
      invitations: [],

      ensureOwner: (companyId, userId, email, fullName) => {
        const existing = get().memberships.find(
          (m) => m.company_id === companyId && m.role === 'owner'
        )
        if (existing) return

        const membership = makeMembership(
          companyId,
          { email, full_name: fullName ?? undefined, role: 'owner' },
          { status: 'active', billedAsAddon: false, userId }
        )
        const prev = get().memberships
        set((s) => ({ memberships: [...s.memberships, membership] }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          // Solo enviar columnas que existen en la tabla DB
          await dbWrite(
            'membership:ensureOwner',
            supabase.from('memberships').upsert({
              id: membership.id,
              company_id: membership.company_id,
              user_id: membership.user_id,
              email: membership.email,
              full_name: membership.full_name,
              role: membership.role,
              status: membership.status,
            } as never, { onConflict: 'company_id,user_id' }),
            {
              silent: true,
              rollback: () => set({ memberships: prev }),
            }
          )
        })()
      },

      getByCompany: (companyId) =>
        get().memberships.filter((m) => m.company_id === companyId),

      getMemberCount: (companyId) =>
        get().memberships.filter(
          (m) => m.company_id === companyId && m.status !== 'revoked'
        ).length,

      canInviteGate: (companyId) => {
        const subscription = useWorkspaceStore.getState().subscription
        const hasActive =
          subscription?.status === 'active' || subscription?.status === 'trial'
        return evaluateInviteMember({
          currentMemberCount: get().getMemberCount(companyId),
          hasActiveSubscription: hasActive,
        })
      },

      inviteMember: (companyId, draft, _ownerUserId) => {
        const gate = get().canInviteGate(companyId)
        if (!gate.allowed || gate.requires_payment) {
          return { gate }
        }

        const membership = makeMembership(companyId, draft, {
          status: 'invited',
          billedAsAddon: false,
        })
        const prev = get().memberships
        set((s) => ({ memberships: [...s.memberships, membership] }))
        void (async () => {
          const [{ inviteMember: inviteInDB }, { useAuthStore }] = await Promise.all([
            import('@/services/memberships.service'),
            import('@/stores/authStore'),
          ])
          const invitedBy = useAuthStore.getState().user?.id ?? ''
          await dbWrite(
            'membership:inviteMember',
            inviteInDB(companyId, draft.email, draft.role ?? 'viewer', invitedBy),
            {
              errorMessage: 'No se pudo enviar la invitación.',
              rollback: () => set({ memberships: prev }),
            }
          )
        })()
        return { gate, membership }
      },

      confirmInviteMember: (companyId, draft, ownerUserId, paymentRef) => {
        const membership = makeMembership(companyId, draft, {
          status: 'invited',
          billedAsAddon: true,
        })

        // Registrar add-on extra_member en workspaceStore.
        useWorkspaceStore.getState().addAddon({
          user_id: ownerUserId,
          type: 'extra_member',
          company_id: companyId,
          quantity: 1,
          unit_price: ADDON_PRICES.extra_member,
          currency: CURRENCY,
          interval: 'monthly',
          status: 'active',
          provider: paymentRef ? 'manual' : 'none',
          provider_ref: paymentRef ?? null,
          canceled_at: null,
        })

        const prev = get().memberships
        set((s) => ({ memberships: [...s.memberships, membership] }))
        void (async () => {
          const { inviteMember: inviteInDB } = await import('@/services/memberships.service')
          await dbWrite(
            'membership:confirmInviteMember',
            inviteInDB(companyId, draft.email, draft.role ?? 'viewer', ownerUserId),
            {
              errorMessage: 'No se pudo confirmar la invitación.',
              rollback: () => set({ memberships: prev }),
            }
          )
        })()
        return membership
      },

      updateMembership: (id, updates) => {
        const prev = get().memberships
        set((s) => ({
          memberships: s.memberships.map((m) =>
            m.id === id ? { ...m, ...updates, updated_at: new Date().toISOString() } : m
          ),
        }))
        const role = (updates as { role?: WorkspaceRole }).role
        if (!role) return
        void (async () => {
          const { updateMemberRole } = await import('@/services/memberships.service')
          await dbWrite(
            'membership:updateRole',
            updateMemberRole(id, role),
            {
              errorMessage: 'No se pudo actualizar el rol del miembro.',
              rollback: () => set({ memberships: prev }),
            }
          )
        })()
      },

      removeMember: (id) => {
        // Cancelar add-on asociado si fue cobrado.
        const member = get().memberships.find((m) => m.id === id)
        if (member?.billed_as_addon) {
          const addOns = useWorkspaceStore.getState().addOns
          const linked = addOns.find(
            (a) =>
              a.type === 'extra_member' &&
              a.company_id === member.company_id &&
              a.status === 'active'
          )
          if (linked) {
            useWorkspaceStore.getState().cancelAddon(linked.id)
          }
        }
        const prev = get().memberships
        set((s) => ({
          memberships: s.memberships.map((m) =>
            m.id === id
              ? { ...m, status: 'revoked' as const, updated_at: new Date().toISOString() }
              : m
          ),
        }))
        void (async () => {
          const { removeMember: removeInDB } = await import('@/services/memberships.service')
          await dbWrite(
            'membership:removeMember',
            removeInDB(id),
            {
              errorMessage: 'No se pudo remover el miembro.',
              rollback: () => set({ memberships: prev }),
            }
          )
        })()
      },

      resetAll: () => set({ memberships: [], invitations: [] }),

      loadFromDB: async (companyId) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('memberships')
            .select('id, company_id, user_id, email, full_name, role, status, created_at, updated_at')
            .eq('company_id', companyId)
          if (error || !data) return
          // Conserva memberships de OTRAS empresas ya cargadas; reemplaza las de companyId.
          set((s) => {
            const others = s.memberships.filter((m) => m.company_id !== companyId)
            const fresh: Membership[] = data.map((r) => ({
              id: r.id,
              company_id: r.company_id,
              user_id: r.user_id ?? null,
              email: r.email,
              full_name: r.full_name ?? null,
              role: r.role as WorkspaceRole,
              status: (r.status ?? 'active') as MembershipStatus,
              billed_as_addon: false,
              invited_at: r.created_at,
              accepted_at: r.status === 'active' ? r.created_at : null,
              created_at: r.created_at,
              updated_at: r.updated_at,
            }))
            return { memberships: [...others, ...fresh] }
          })
        } catch { /* silent */ }
      },
    }),
    {
      name: 'lean-process-memberships',
      version: 1,
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
