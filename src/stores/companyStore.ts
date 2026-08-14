import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Company,
  ProcessLevelName,
  OrgLevelDefinition,
  OrgUnit,
} from '@/types'
import { getNodeDepth, getAllDescendantIds } from '@/utils/tree'
import type { DocCodePattern } from '@/utils/docCode'
import { toast } from './toastStore'
import { useAuthStore } from './authStore'
import { useWorkspaceStore } from './workspaceStore'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

function getCurrentUserId(): string {
  return useAuthStore.getState().profile?.id ?? useAuthStore.getState().user?.id ?? 'anonymous'
}

interface CompanyState {
  company: Company | null
  processLevelNames: ProcessLevelName[]
  orgLevelDefinitions: OrgLevelDefinition[]
  orgUnits: OrgUnit[]
  onboardingStep: number

  // Company
  setCompanyName: (name: string) => void
  setCompanyInfo: (info: { name: string; industry?: string; company_size?: string; country?: string; description?: string }) => void

  // Process levels
  setProcessLevelCount: (count: number) => void
  setProcessLevelNames: (names: ProcessLevelName[]) => void

  // Codificacion de documentos (paso 5 del alta)
  setDocCodeConfig: (pattern: DocCodePattern, prefix: string) => void

  // Org level definitions
  setOrgLevelDefinitions: (defs: OrgLevelDefinition[]) => void
  addOrgLevelDefinition: (name: string) => void
  removeOrgLevelDefinition: (id: string) => void
  updateOrgLevelDefinitionName: (id: string, name: string) => void

  // Org units CRUD
  addOrgUnit: (name: string, parentId: string | null) => void
  updateOrgUnit: (id: string, updates: Partial<OrgUnit>) => void
  deleteOrgUnit: (id: string) => void

  // Onboarding
  setOnboardingStep: (step: number) => void
  completeOnboarding: () => Promise<void>
  isOnboardingComplete: () => boolean

  /**
   * Sincroniza el store con la empresa activa de workspaceStore.
   * En multi-empresa cada empresa tendra su propia estructura
   * organizacional; este metodo es el punto de integracion.
   */
  syncWithActiveCompany: (company: Company | null) => void

  // Reset
  resetAll: () => void

  // DB sync
  loadOrgFromDB: (companyId: string) => Promise<void>
  syncOrgToDB: (companyId: string) => Promise<void>
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      company: null,
      processLevelNames: [],
      orgLevelDefinitions: [],
      orgUnits: [],
      onboardingStep: 1,

      setCompanyName: (name: string) => {
        const now = new Date().toISOString()
        const userId = getCurrentUserId()
        set((state) => ({
          company: state.company
            ? { ...state.company, name, updated_at: now }
            : {
                id: generateId(),
                user_id: userId,
                name,
                onboarding_completed: false,
                process_level_count: 3,
                created_at: now,
                updated_at: now,
              },
        }))
      },

      setCompanyInfo: (info) => {
        const now = new Date().toISOString()
        const userId = getCurrentUserId()
        set((state) => ({
          company: state.company
            ? { ...state.company, ...info, updated_at: now }
            : {
                id: generateId(),
                user_id: userId,
                name: info.name,
                industry: info.industry,
                company_size: info.company_size,
                country: info.country,
                description: info.description,
                onboarding_completed: false,
                process_level_count: 3,
                created_at: now,
                updated_at: now,
              },
        }))
        toast.success('Empresa guardada exitosamente')
      },

      setProcessLevelCount: (count: number) => {
        set((state) => ({
          company: state.company
            ? { ...state.company, process_level_count: count, updated_at: new Date().toISOString() }
            : state.company,
        }))
      },

      setProcessLevelNames: (names: ProcessLevelName[]) => {
        set({ processLevelNames: names })
      },

      setDocCodeConfig: (pattern: DocCodePattern, prefix: string) => {
        set((state) => ({
          company: state.company
            ? { ...state.company, doc_code_pattern: pattern, doc_code_prefix: prefix, updated_at: new Date().toISOString() }
            : state.company,
        }))
      },

      setOrgLevelDefinitions: (defs: OrgLevelDefinition[]) => {
        set({ orgLevelDefinitions: defs })
      },

      addOrgLevelDefinition: (name: string) => {
        const { orgLevelDefinitions, company } = get()
        const companyId = useWorkspaceStore.getState().activeCompanyId ?? ''
        const maxLevel = orgLevelDefinitions.reduce(
          (max, d) => Math.max(max, d.level_number),
          -1
        )
        const newDef: OrgLevelDefinition = {
          id: generateId(),
          company_id: companyId,
          level_number: maxLevel + 1,
          level_name: name,
          created_at: new Date().toISOString(),
        }
        const prev = orgLevelDefinitions
        set({ orgLevelDefinitions: [...orgLevelDefinitions, newDef] })
        // Durante el onboarding, diferir todos los writes a DB: completeOnboarding
        // hará el upsert masivo cuando la empresa y sus niveles ya existan en DB.
        if (!companyId || !company?.onboarding_completed) return
        void dbWrite(
          'company:addOrgLevel',
          supabase.from('org_level_definitions').insert(newDef as never),
          {
            successMessage: 'Nivel organizacional creado.',
            errorMessage: 'No se pudo crear el nivel organizacional.',
            rollback: () => set({ orgLevelDefinitions: prev }),
          }
        )
      },

      removeOrgLevelDefinition: (id: string) => {
        const { company } = get()
        const prev = get().orgLevelDefinitions
        set((state) => {
          const filtered = state.orgLevelDefinitions.filter((d) => d.id !== id)
          const renumbered = filtered.map((d, i) => ({
            ...d,
            level_number: i,
          }))
          return { orgLevelDefinitions: renumbered }
        })
        if (!company?.onboarding_completed) return
        void dbWrite(
          'company:removeOrgLevel',
          supabase.from('org_level_definitions').delete().eq('id', id),
          {
            successMessage: 'Nivel organizacional eliminado.',
            errorMessage: 'No se pudo eliminar el nivel organizacional.',
            rollback: () => set({ orgLevelDefinitions: prev }),
          }
        )
      },

      updateOrgLevelDefinitionName: (id: string, name: string) => {
        const { company } = get()
        const prev = get().orgLevelDefinitions
        set((state) => ({
          orgLevelDefinitions: state.orgLevelDefinitions.map((d) =>
            d.id === id ? { ...d, level_name: name } : d
          ),
        }))
        if (!useWorkspaceStore.getState().activeCompanyId || !company?.onboarding_completed) return
        void dbWrite(
          'company:updateOrgLevelName',
          supabase.from('org_level_definitions').update({ level_name: name } as never).eq('id', id),
          {
            successMessage: 'Nivel organizacional actualizado.',
            errorMessage: 'No se pudo actualizar el nombre del nivel.',
            rollback: () => set({ orgLevelDefinitions: prev }),
          }
        )
      },

      addOrgUnit: (name: string, parentId: string | null) => {
        const { orgUnits, orgLevelDefinitions, company } = get()
        const companyId = useWorkspaceStore.getState().activeCompanyId ?? ''
        const now = new Date().toISOString()

        let depth = 0
        if (parentId) {
          depth = getNodeDepth(parentId, orgUnits) + 1
        }

        const levelDef = orgLevelDefinitions.find((ld) => ld.level_number === depth)
        const siblings = orgUnits.filter((u) => u.parent_id === parentId)
        const sortOrder = siblings.length

        const newUnit: OrgUnit = {
          id: generateId(),
          company_id: companyId,
          org_level_definition_id: levelDef?.id ?? null,
          parent_id: parentId,
          name,
          sort_order: sortOrder,
          created_at: now,
          updated_at: now,
        }

        const prev = orgUnits
        set({ orgUnits: [...orgUnits, newUnit] })
        // Durante el onboarding, diferir el write a DB: completeOnboarding hace el upsert
        // masivo de niveles y unidades en orden correcto, evitando FK violations por
        // org_level_definition_id que aún no existe en DB.
        if (!companyId || !company?.onboarding_completed) {
          if (!companyId) console.warn('[companyStore] addOrgUnit sin companyId — insert omitido')
          return
        }
        void dbWrite(
          'company:addOrgUnit',
          supabase.from('org_units').insert(newUnit as never),
          {
            successMessage: 'Unidad organizacional creada.',
            errorMessage: 'No se pudo crear la unidad organizacional.',
            rollback: () => set({ orgUnits: prev }),
          }
        )
      },

      updateOrgUnit: (id: string, updates: Partial<OrgUnit>) => {
        const prev = get().orgUnits
        set((state) => ({
          orgUnits: state.orgUnits.map((u) =>
            u.id === id ? { ...u, ...updates, updated_at: new Date().toISOString() } : u
          ),
        }))
        void dbWrite(
          'company:updateOrgUnit',
          supabase.from('org_units').update({ ...updates, updated_at: new Date().toISOString() } as never).eq('id', id),
          {
            successMessage: 'Unidad organizacional actualizada.',
            errorMessage: 'No se pudo actualizar la unidad organizacional.',
            rollback: () => set({ orgUnits: prev }),
          }
        )
      },

      deleteOrgUnit: (id: string) => {
        const { orgUnits } = get()
        const descendantIds = getAllDescendantIds(id, orgUnits)
        const idsToDelete = [id, ...descendantIds]
        const toDelete = new Set(idsToDelete)
        const prev = orgUnits
        set({ orgUnits: orgUnits.filter((u) => !toDelete.has(u.id)) })
        void dbWrite(
          'company:deleteOrgUnits',
          supabase.from('org_units').delete().in('id', idsToDelete),
          {
            successMessage: 'Unidad organizacional eliminada.',
            errorMessage: 'No se pudo eliminar la unidad.',
            rollback: () => set({ orgUnits: prev }),
          }
        )
      },

      setOnboardingStep: (step: number) => {
        set({ onboardingStep: step })
      },

      completeOnboarding: async () => {
        const { company, orgLevelDefinitions, orgUnits } = get()
        const now = new Date().toISOString()
        const completedCompany = company
          ? { ...company, onboarding_completed: true, updated_at: now }
          : null

        // Optimistic: marcar empresa como completada localmente para que ProtectedRoute la vea.
        // onboardingStep se resetea a 0 solo al final del happy path (post DB writes) para
        // evitar que OnboardingPage redirija a /app prematuramente si los writes fallan.
        set({ company: completedCompany })

        if (completedCompany) {
          // Registrar la empresa en workspaceStore.companies SIN fijar activeCompanyId todavía.
          // Si fijáramos activeCompanyId aquí, useWorkspaceSync dispararía loadOrgFromDB antes
          // de que las unidades del organigrama estén persistidas en DB, borrando el estado local
          // y dejando el organigrama vacío. activeCompanyId se fija al final, tras todos los writes.
          const ws = useWorkspaceStore.getState()
          const alreadyExists = ws.companies.some((c) => c.id === completedCompany.id)
          if (!alreadyExists) {
            useWorkspaceStore.setState({ companies: [...ws.companies, completedCompany] })
          } else {
            useWorkspaceStore.setState({
              companies: ws.companies.map((c) =>
                c.id === completedCompany.id ? completedCompany : c
              ),
            })
          }

          // La empresa en sí solo vivía en localStorage durante el onboarding
          // (setCompanyInfo no persiste). Ahora que terminamos, hacemos upsert
          // completo para que quede la fila en DB; onConflict:'id' re-usa el
          // id generado en memoria.
          //
          // Crítico: si falla, el usuario vería MainLayout (porque el flag local
          // ya dice onboarding_completed=true) pero al recargar/cambiar dispositivo
          // perdería la empresa. Por eso: toast de error + rollback del flag local.
          const companyWrite = await dbWrite(
            'company:completeOnboarding:upsertCompany',
            supabase
              .from('companies')
              .upsert({
                id: completedCompany.id,
                user_id: completedCompany.user_id,
                name: completedCompany.name,
                industry: completedCompany.industry ?? null,
                company_size: completedCompany.company_size ?? null,
                country: completedCompany.country ?? null,
                description: completedCompany.description ?? null,
                logo_url: (completedCompany as unknown as { logo_url?: string | null }).logo_url ?? null,
                onboarding_completed: completedCompany.onboarding_completed,
                process_level_count: completedCompany.process_level_count ?? 3,
                doc_code_pattern: completedCompany.doc_code_pattern ?? null,
                doc_code_prefix: completedCompany.doc_code_prefix ?? null,
                created_at: completedCompany.created_at,
                updated_at: completedCompany.updated_at,
                milestone_completions: (completedCompany as unknown as { milestone_completions?: unknown }).milestone_completions ?? {},
              } as import('@/types/database').Database['public']['Tables']['companies']['Insert'], { onConflict: 'id' }),
            {
              errorMessage: 'No se pudo guardar la empresa en la nube. Inténtalo de nuevo.',
              rollback: () => {
                // Revertir el flag para que el usuario vuelva a /onboarding y pueda reintentar.
                set({ company: company ? { ...company, onboarding_completed: false } : null })
                const ws2 = useWorkspaceStore.getState()
                useWorkspaceStore.setState({
                  companies: ws2.companies.map((c) =>
                    c.id === completedCompany.id ? { ...c, onboarding_completed: false } : c
                  ),
                })
              },
            }
          )
          if (!companyWrite.ok) return

          // Batch upsert de la estructura organizacional construida durante el onboarding.
          // Durante los steps 3 y 4 el activeCompanyId era null, por lo que los inserts
          // individuales se omitieron (company_id quedó ''). Corregimos el company_id ahora
          // y persistimos todo de una vez. onConflict:'id' hace idempotente el caso de
          // re-ejecutar el onboarding.
          const defsWithCompany = orgLevelDefinitions.map((d) => ({ ...d, company_id: completedCompany.id }))
          const unitsWithCompany = orgUnits.map((u) => ({ ...u, company_id: completedCompany.id }))
          set({ orgLevelDefinitions: defsWithCompany, orgUnits: unitsWithCompany })

          if (defsWithCompany.length > 0) {
            const levelsResult = await dbWrite(
              'company:completeOnboarding:upsertOrgLevels',
              supabase
                .from('org_level_definitions')
                .upsert(defsWithCompany as unknown as import('@/types/database').Database['public']['Tables']['org_level_definitions']['Insert'][], { onConflict: 'id' }),
              { errorMessage: 'No se pudieron guardar los niveles del organigrama.' }
            )
            // Si los niveles no se persistieron, las unidades fallarían con FK violation.
            if (!levelsResult.ok) return
          }
          if (unitsWithCompany.length > 0) {
            await dbWrite(
              'company:completeOnboarding:upsertOrgUnits',
              supabase
                .from('org_units')
                .upsert(unitsWithCompany as unknown as import('@/types/database').Database['public']['Tables']['org_units']['Insert'][], { onConflict: 'id' }),
              { errorMessage: 'No se pudieron guardar las unidades del organigrama.' }
            )
          }

          // Todos los writes completaron. Ahora sí activar la empresa:
          // loadOrgFromDB correrá y encontrará las unidades ya persistidas en DB.
          useWorkspaceStore.setState({ activeCompanyId: completedCompany.id })
          // Forzar sync desde DB: useWorkspaceSync usa lastSyncedRef y no re-fetcha
          // si el activeCompanyId no cambió (caso reset + re-onboarding misma empresa).
          await get().loadOrgFromDB(completedCompany.id)
          set({ onboardingStep: 0 })
        }
      },

      isOnboardingComplete: () => {
        const { company } = get()
        return company?.onboarding_completed === true
      },

      syncWithActiveCompany: (company) => {
        const currentId = get().company?.id
        if (company?.id !== currentId) {
          // Solo limpiar org al cambiar de empresa — loadOrgFromDB recargará los datos
          set({ company, orgLevelDefinitions: [], orgUnits: [] })
        } else {
          // Misma empresa: actualizar metadata sin borrar la estructura organizacional
          set({ company })
        }
      },

      resetAll: () => {
        set({
          company: null,
          processLevelNames: [],
          orgLevelDefinitions: [],
          orgUnits: [],
          onboardingStep: 1,
        })
      },

      loadOrgFromDB: async (companyId) => {
        // Limpiar primero para no mostrar datos de otra empresa mientras carga
        set({ orgLevelDefinitions: [], orgUnits: [] })
        try {
          const [defsResult, unitsResult] = await Promise.all([
            supabase.from('org_level_definitions')
              .select('*').eq('company_id', companyId).order('level_number'),
            supabase.from('org_units')
              .select('*').eq('company_id', companyId).order('sort_order'),
          ])
          if (defsResult.error) console.warn('[companyStore] Error cargando org levels:', defsResult.error.message)
          if (unitsResult.error) console.warn('[companyStore] Error cargando org units:', unitsResult.error.message)
          // Solo actualizar si al menos una consulta fue exitosa
          if (!defsResult.error || !unitsResult.error) {
            set({
              orgLevelDefinitions: defsResult.error ? [] : (defsResult.data as unknown as OrgLevelDefinition[]) ?? [],
              orgUnits: unitsResult.error ? [] : (unitsResult.data as unknown as OrgUnit[]) ?? [],
            })
          }
        } catch (err) {
          console.warn('[companyStore] Error en loadOrgFromDB:', err)
        }
      },

      syncOrgToDB: async (companyId) => {
        const { orgLevelDefinitions, orgUnits } = get()
        try {
          if (orgLevelDefinitions.length > 0) {
            await supabase.from('org_level_definitions')
              .upsert(orgLevelDefinitions.map((d) => ({ ...d, company_id: companyId })))
          }
          if (orgUnits.length > 0) {
            await supabase.from('org_units')
              .upsert(orgUnits.map((u) => ({ ...u, company_id: companyId })))
          }
        } catch (err) {
          console.warn('[companyStore] Error guardando org_units en DB:', err)
        }
      },
    }),
    {
      name: 'lean-process-company',
      version: 2,
      partialize: (state) => ({
        company: state.company,
        processLevelNames: state.processLevelNames,
        orgLevelDefinitions: state.orgLevelDefinitions,
        orgUnits: state.orgUnits,
        onboardingStep: state.onboardingStep,
      }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
