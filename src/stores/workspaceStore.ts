/**
 * workspaceStore
 * --------------
 * Estado central del modelo multi-empresa B2C.
 *
 * Responsabilidades:
 *  1. Mantener la lista de empresas (workspaces) que posee el usuario.
 *  2. Exponer la empresa activa (activeCompanyId). El resto de stores
 *     filtra su data por este id.
 *  3. Modelar la suscripcion base y los add-ons de cobro (extra_company,
 *     extra_member, ...).
 *  4. Exponer "billing gates": helpers que le dicen a la UI si una
 *     accion requiere pago antes de ejecutarse.
 *
 * Diseno:
 *  - Persistencia en localStorage via Zustand `persist`. Cuando se
 *    integre Supabase/Stripe, los mismos metodos pueden hacer fetch
 *    remoto sin cambiar la interfaz publica del store.
 *  - `createCompany` es una operacion en dos pasos: primero retorna
 *    un BillingGate, el UI decide si confirmar el cobro, y luego
 *    llama `confirmCreateCompany` para materializarla.
 *  - El primer usuario demo arranca con una suscripcion "trial" activa
 *    de forma automatica, para que la UI nunca quede bloqueada.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Company } from '@/types/organization'
import type {
  AddOn,
  AddOnType,
  BillingGate,
  BillingInterval,
  Invoice,
  PaymentProvider,
  Subscription,
} from '@/types/billing'
import {
  ADDON_PRICES,
  BASE_PLAN,
  CURRENCY,
  estimateMonthlyTotal,
  evaluateCreateCompany,
  type MonthlyTotalBreakdown,
} from '@/lib/pricing'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

// ─── Types ────────────────────────────────────────────────────────────────

export interface CompanyDraft {
  name: string
  industry?: string
  company_size?: string
  country?: string
  description?: string
}

export interface CreateCompanyResult {
  gate: BillingGate
  /** Solo existe si la empresa se creo sin requerir pago. */
  company?: Company
}

export interface ConfirmCreateCompanyArgs {
  draft: CompanyDraft
  /** Referencia de la pasarela (ej: stripe invoice id). Para MVP es opcional. */
  paymentRef?: string
  provider?: PaymentProvider
}

interface WorkspaceState {
  // ─── Data ──────────────────────────────────────────────────────────────
  companies: Company[]
  activeCompanyId: string | null
  subscription: Subscription | null
  addOns: AddOn[]
  invoices: Invoice[]

  // ─── Company CRUD ──────────────────────────────────────────────────────
  /**
   * Evalua si el usuario puede crear una empresa. Si el plan base la
   * cubre, la crea de inmediato. Si no, devuelve un gate con el monto
   * pendiente y NO crea nada. El UI debe llamar `confirmCreateCompany`
   * despues de cobrar.
   */
  createCompany: (draft: CompanyDraft, userId: string) => CreateCompanyResult
  /**
   * Materializa una empresa luego de que el UI confirmo el pago. Crea
   * el add-on extra_company en estado 'active'.
   */
  confirmCreateCompany: (args: ConfirmCreateCompanyArgs, userId: string) => Company
  updateCompany: (id: string, updates: Partial<Company>) => void
  deleteCompany: (id: string) => void
  setActiveCompany: (id: string | null) => void
  getActiveCompany: () => Company | null
  completeCompanyOnboarding: (id: string) => void

  // ─── Subscription ──────────────────────────────────────────────────────
  startTrialIfNeeded: (userId: string) => void
  setSubscription: (sub: Subscription | null) => void
  cancelSubscription: () => void

  // ─── Add-ons ───────────────────────────────────────────────────────────
  addAddon: (addOn: Omit<AddOn, 'id' | 'created_at' | 'updated_at'>) => AddOn
  cancelAddon: (id: string) => void
  getActiveAddonsFor: (companyId: string, type?: AddOnType) => AddOn[]

  // ─── Billing queries ───────────────────────────────────────────────────
  canCreateCompanyGate: () => BillingGate
  getMonthlyTotal: () => MonthlyTotalBreakdown

  // ─── Debug / reset ─────────────────────────────────────────────────────
  resetAll: () => void

  // ─── DB sync ───────────────────────────────────────────────────────────────
  loadCompaniesFromDB: (userId: string) => Promise<void>
  syncCompanyToDB: (id: string, updates: Partial<Company>) => Promise<void>
  deleteCompanyFromDB: (id: string) => Promise<void>
}

// ─── Factories ────────────────────────────────────────────────────────────

function makeTrialSubscription(userId: string): Subscription {
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14) // 14 dias
  const periodEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)
  return {
    id: generateId(),
    user_id: userId,
    plan_id: BASE_PLAN.id,
    status: 'trial',
    interval: 'monthly' as BillingInterval,
    base_price: BASE_PLAN.price_monthly,
    currency: CURRENCY,
    provider: 'none',
    provider_ref: null,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    trial_ends_at: trialEnd.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
}

function makeCompany(draft: CompanyDraft, userId: string): Company {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    user_id: userId,
    name: draft.name,
    industry: draft.industry,
    company_size: draft.company_size,
    country: draft.country,
    description: draft.description,
    onboarding_completed: false,
    process_level_count: 3,
    created_at: now,
    updated_at: now,
  }
}

function makeAddon(
  input: Omit<AddOn, 'id' | 'created_at' | 'updated_at'>
): AddOn {
  const now = new Date().toISOString()
  return {
    ...input,
    id: generateId(),
    created_at: now,
    updated_at: now,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      companies: [],
      activeCompanyId: null,
      subscription: null,
      addOns: [],
      invoices: [],

      // ─── Company CRUD ──────────────────────────────────────────────────
      createCompany: (draft, userId) => {
        const { companies, subscription } = get()
        const gate = evaluateCreateCompany({
          currentCompanyCount: companies.length,
          hasActiveSubscription:
            subscription?.status === 'active' || subscription?.status === 'trial',
        })

        if (!gate.allowed || gate.requires_payment) {
          return { gate }
        }

        // Primera empresa: incluida en el plan. Crear directamente.
        const company = makeCompany(draft, userId)
        const prevCompanies = get().companies
        const prevActiveId = get().activeCompanyId
        set((s) => ({
          companies: [...s.companies, company],
          activeCompanyId: s.activeCompanyId ?? company.id,
        }))

        void (async () => {
          const { createCompany: createInDB } = await import('@/services/companies.service')
          await dbWrite(
            'workspace:createCompany',
            createInDB({ ...company, owner_id: userId }),
            {
              successMessage: 'Empresa creada correctamente.',
              errorMessage: 'No se pudo guardar la empresa en la nube.',
              rollback: () => set({ companies: prevCompanies, activeCompanyId: prevActiveId }),
            }
          )
        })()

        return { gate, company }
      },

      confirmCreateCompany: ({ draft, paymentRef, provider = 'manual' }, userId) => {
        const company = makeCompany(draft, userId)

        // Registrar el add-on de cobro por la empresa extra.
        const addOn = makeAddon({
          user_id: userId,
          type: 'extra_company',
          company_id: company.id,
          quantity: 1,
          unit_price: ADDON_PRICES.extra_company,
          currency: CURRENCY,
          interval: 'monthly',
          status: 'active',
          provider,
          provider_ref: paymentRef ?? null,
          canceled_at: null,
        })

        const prevCompanies = get().companies
        const prevAddOns = get().addOns
        const prevActiveId = get().activeCompanyId
        set((s) => ({
          companies: [...s.companies, company],
          addOns: [...s.addOns, addOn],
          activeCompanyId: s.activeCompanyId ?? company.id,
        }))

        void (async () => {
          const { createCompany: createInDB } = await import('@/services/companies.service')
          await dbWrite(
            'workspace:confirmCreateCompany',
            createInDB({ ...company, owner_id: userId }),
            {
              successMessage: 'Empresa creada correctamente.',
              errorMessage: 'No se pudo guardar la empresa extra en la nube.',
              rollback: () => set({
                companies: prevCompanies,
                addOns: prevAddOns,
                activeCompanyId: prevActiveId,
              }),
            }
          )
        })()

        return company
      },

      updateCompany: (id, updates) => {
        const prev = get().companies
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
          ),
        }))
        void (async () => {
          const { updateCompany: updateInDB } = await import('@/services/companies.service')
          await dbWrite(
            'workspace:updateCompany',
            updateInDB(id, updates),
            {
              successMessage: 'Empresa actualizada correctamente.',
              errorMessage: 'No se pudo actualizar la empresa.',
              rollback: () => set({ companies: prev }),
            }
          )
        })()
      },

      deleteCompany: (id) => {
        if (get().companies.length <= 1) return
        const prev = {
          companies: get().companies,
          addOns: get().addOns,
          activeCompanyId: get().activeCompanyId,
        }
        set((s) => {
          const remaining = s.companies.filter((c) => c.id !== id)
          const updatedAddOns = s.addOns.map((a) =>
            a.company_id === id && a.status === 'active'
              ? { ...a, status: 'canceled' as const, canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }
              : a
          )
          const nextActive =
            s.activeCompanyId === id ? remaining[0]?.id ?? null : s.activeCompanyId
          return {
            companies: remaining,
            addOns: updatedAddOns,
            activeCompanyId: nextActive,
          }
        })
        void (async () => {
          const { deleteCompany: deleteInDB } = await import('@/services/companies.service')
          await dbWrite(
            'workspace:deleteCompany',
            deleteInDB(id),
            {
              errorMessage: 'No se pudo eliminar la empresa.',
              rollback: () => set(prev),
            }
          )
        })()
      },

      setActiveCompany: (id) => set({ activeCompanyId: id }),

      getActiveCompany: () => {
        const { companies, activeCompanyId } = get()
        if (!activeCompanyId) return null
        return companies.find((c) => c.id === activeCompanyId) ?? null
      },

      completeCompanyOnboarding: (id) => {
        const prev = get().companies
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, onboarding_completed: true, updated_at: new Date().toISOString() } : c
          ),
        }))
        void (async () => {
          const { updateCompany: updateInDB } = await import('@/services/companies.service')
          await dbWrite(
            'workspace:completeCompanyOnboarding',
            updateInDB(id, { onboarding_completed: true } as never),
            {
              errorMessage: 'No se pudo marcar el onboarding como completo.',
              rollback: () => set({ companies: prev }),
            }
          )
        })()
      },

      // ─── Subscription ──────────────────────────────────────────────────
      startTrialIfNeeded: (userId) => {
        const { subscription, activeCompanyId } = get()
        if (subscription) return
        const sub = makeTrialSubscription(userId)
        set({ subscription: sub })
        // Solo persistir si hay empresa activa: subscriptions en DB está indexado
        // por company_id (NOT NULL). El objeto en memoria incluye user_id para el
        // contexto de la UI, pero no se envía al DB.
        if (!activeCompanyId) return
        import('@/lib/supabase').then(({ supabase }) => {
          const { user_id: _omit, ...rest } = sub as Subscription & { user_id?: string }
          void _omit
          const row = { ...rest, company_id: activeCompanyId }
          supabase.from('subscriptions').upsert(row).then(({ error }) => {
            if (error) console.warn('[workspaceStore] Error persistiendo suscripción:', error.message)
          })
        })
      },

      setSubscription: (sub) => {
        set({ subscription: sub })
        if (!sub) return
        const activeCompanyId = get().activeCompanyId
        if (!activeCompanyId) return
        import('@/lib/supabase').then(({ supabase }) => {
          const { user_id: _omit, ...rest } = sub as Subscription & { user_id?: string }
          void _omit
          const row = { ...rest, company_id: activeCompanyId }
          supabase.from('subscriptions').upsert(row).then(({ error }) => {
            if (error) console.warn('[workspaceStore] Error actualizando suscripción:', error.message)
          })
        })
      },

      cancelSubscription: () => {
        set((s) => {
          if (!s.subscription) return s
          return {
            subscription: {
              ...s.subscription,
              status: 'canceled',
              cancel_at_period_end: true,
              updated_at: new Date().toISOString(),
            },
          }
        })
        const sub = get().subscription
        if (!sub) return
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.from('subscriptions')
            .update({ status: 'canceled', cancel_at_period_end: true, updated_at: new Date().toISOString() })
            .eq('id', sub.id)
            .then(({ error }) => {
              if (error) console.warn('[workspaceStore] Error cancelando suscripción:', error.message)
            })
        })
      },

      // ─── Add-ons ───────────────────────────────────────────────────────
      addAddon: (addOnInput) => {
        const addOn = makeAddon(addOnInput)
        set((s) => ({ addOns: [...s.addOns, addOn] }))
        // Persistir en Supabase (fire-and-forget)
        import('@/lib/supabase').then(({ supabase }) => {
          if (addOn.company_id) {
            const { user_id: _omit, ...row } = addOn
            void _omit
            supabase.from('company_addons').insert({ ...row, company_id: addOn.company_id }).then(({ error }) => {
              if (error) console.warn('[workspaceStore] Error persistiendo add-on:', error.message)
            })
          }
        })
        return addOn
      },

      cancelAddon: (id) => {
        set((s) => ({
          addOns: s.addOns.map((a) =>
            a.id === id
              ? { ...a, status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() }
              : a
          ),
        }))
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.from('company_addons')
            .update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', id)
            .then(({ error }) => {
              if (error) console.warn('[workspaceStore] Error cancelando add-on:', error.message)
            })
        })
      },

      getActiveAddonsFor: (companyId, type) => {
        return get().addOns.filter(
          (a) =>
            a.status === 'active' &&
            a.company_id === companyId &&
            (type ? a.type === type : true)
        )
      },

      // ─── Billing queries ───────────────────────────────────────────────
      canCreateCompanyGate: () => {
        const { companies, subscription } = get()
        return evaluateCreateCompany({
          currentCompanyCount: companies.length,
          hasActiveSubscription:
            subscription?.status === 'active' || subscription?.status === 'trial',
        })
      },

      getMonthlyTotal: () => {
        const { subscription, addOns } = get()
        return estimateMonthlyTotal(subscription, addOns)
      },

      // ─── Reset ─────────────────────────────────────────────────────────
      resetAll: () =>
        set({
          companies: [],
          activeCompanyId: null,
          subscription: null,
          addOns: [],
          invoices: [],
        }),

      // ─── DB sync ───────────────────────────────────────────────────────
      loadCompaniesFromDB: async (userId) => {
        try {
          const { getCompanies } = await import('@/services/companies.service')
          const { data, error } = await getCompanies(userId)
          if (error) {
            console.error('[workspaceStore] loadCompaniesFromDB error:', error.message)
            return
          }

          // Caso: no hay empresas para este usuario. Reset controlado del estado
          // para evitar referencias a empresas borradas y permitir que el gate
          // de onboarding redirija correctamente.
          if (!data || data.length === 0) {
            set({ companies: [], activeCompanyId: null })
            // Limpiar companyStore para evitar que datos stale de localStorage
            // (de otra cuenta o sesión anterior) causen loops de onboarding.
            const { useCompanyStore } = await import('@/stores/companyStore')
            useCompanyStore.setState({ company: null, onboardingStep: 1 })
            return
          }

          // Guardia de aislamiento B2C: nunca mezclar datos de otros usuarios en el store.
          const { useAuthStore: getAuth } = await import('@/stores/authStore')
          const profile = getAuth.getState().profile
          const isAdmin = profile?.is_admin === true
          const filteredData = isAdmin ? data : data.filter(
            (c) => (c as { user_id?: string; owner_id?: string }).user_id === userId
              || (c as { user_id?: string; owner_id?: string }).owner_id === userId
          )

          set((s) => {
            const merged = filteredData.map((dbCompany) => {
              const local = s.companies.find((c) => c.id === dbCompany.id)
              const raw = dbCompany as unknown as Record<string, unknown>
              return {
                ...dbCompany,
                user_id: (raw.owner_id ?? raw.user_id) as string,
                company_size: (local?.company_size ?? raw.company_size) as string | undefined,
                process_level_count: (local?.process_level_count ?? raw.process_level_count ?? 3) as number,
                onboarding_completed: (raw.onboarding_completed ?? local?.onboarding_completed ?? false) as boolean,
              } as unknown as Company
            })

            // Companies solo-locales (creadas sin llegar a DB por error de red, etc.)
            // NO las preservamos si el filtrado de DB es authoritative — el usuario
            // ya recibió un toast de rollback en Sprint 1. Aquí consolidamos DB.
            const allCompanies = merged

            // Validar que activeCompanyId persistido aún existe en el conjunto
            // recargado desde DB. Si el usuario borró la empresa o cambió de
            // cuenta, el ID anterior es huérfano y causaría bucles de onboarding.
            const activeStillValid = s.activeCompanyId && allCompanies.some((c) => c.id === s.activeCompanyId)
            const activeId = activeStillValid ? s.activeCompanyId : (allCompanies[0]?.id ?? null)

            return { companies: allCompanies, activeCompanyId: activeId }
          })

          // Sincronizar add-ons desde DB para limpiar datos obsoletos de localStorage
          const { supabase } = await import('@/lib/supabase')
          const companyIds = filteredData.map((c) => c.id)
          if (companyIds.length > 0) {
            const { data: addOnsData } = await supabase
              .from('company_addons')
              .select('*')
              .in('company_id', companyIds)
            set({ addOns: (addOnsData ?? []) as AddOn[] })
          } else {
            set({ addOns: [] })
          }
        } catch (err) {
          console.error('[workspaceStore] loadCompaniesFromDB exception:', err)
        }
      },

      syncCompanyToDB: async (id, updates) => {
        try {
          const { updateCompany } = await import('@/services/companies.service')
          await updateCompany(id, updates)
        } catch {
          // Silent
        }
      },

      deleteCompanyFromDB: async (id) => {
        try {
          const { deleteCompany } = await import('@/services/companies.service')
          await deleteCompany(id)
        } catch {
          // Silent
        }
      },
    }),
    {
      name: 'lean-process-workspace',
      version: 1,
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
      onRehydrateStorage: () => (state) => {
        // Guarda defensiva post-rehidratación: si el activeCompanyId persistido
        // en localStorage apunta a una empresa que ya no está en la lista
        // (ej. el usuario la borró en otra sesión, o cambió de cuenta), lo
        // reseteamos inmediatamente. Esto previene bucles de onboarding en el
        // primer render antes de que loadCompaniesFromDB valide contra servidor.
        if (!state) return
        if (state.activeCompanyId && !state.companies.some((c) => c.id === state.activeCompanyId)) {
          state.activeCompanyId = state.companies[0]?.id ?? null
        }
      },
    }
  )
)
