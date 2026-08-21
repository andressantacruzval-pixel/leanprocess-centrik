import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'
import { supabase } from '@/lib/supabase'

export interface OnboardingMilestone {
  id: string
  title: string
  description: string
  icon: string       // lucide icon name
  route?: string     // where to navigate
  completed: boolean
}

const DEFAULT_MILESTONES: Omit<OnboardingMilestone, 'completed'>[] = [
  { id: 'company', title: 'Empresa Configurada', description: 'Define tu empresa, giro de negocio e industria', icon: 'Building2', route: '/app/settings' },
  { id: 'org-structure', title: 'Estructura Organizacional', description: 'Crea tu organigrama con departamentos y areas', icon: 'Network', route: '/app/org-structure' },
  { id: 'process-map', title: 'Mapa de Procesos', description: 'Crea tu primer macroproceso con subprocesos', icon: 'Map', route: '/app/process-map' },
  { id: 'bpmn', title: 'Diagrama BPMN', description: 'Diagrama tu primer flujograma de proceso', icon: 'GitBranch', route: '/app/process-map' },
  { id: 'procedure', title: 'Procedimiento Documentado', description: 'Genera un procedimiento desde tu flujograma', icon: 'BookOpen' },
  { id: 'kpi', title: 'Indicadores KPI', description: 'Define indicadores para medir tu proceso', icon: 'TrendingUp' },
  { id: 'risk', title: 'Riesgos Identificados', description: 'Identifica riesgos y controles en tu proceso', icon: 'ShieldAlert' },
  { id: 'audit', title: 'Programa de Auditoria', description: 'Genera un programa de auditoria', icon: 'ClipboardCheck' },
  { id: 'value-analysis', title: 'Analisis de Valor', description: 'Clasifica actividades VA/NVA/NVABN', icon: 'Activity' },
  { id: 'improvement', title: 'Mejoras Identificadas', description: 'Identifica oportunidades de mejora en un proceso', icon: 'Lightbulb' },
  { id: 'improvement-close', title: 'Mejora Cerrada', description: 'Cierra una oportunidad de mejora', icon: 'CheckCircle2' },
  { id: 'report', title: 'Primer Reporte', description: 'Exporta tu primer reporte en PDF o Excel', icon: 'FileText', route: '/app/reports' },
  { id: 'cargo-manual', title: 'Manual de Cargo', description: 'Genera tu primer manual de cargo con IA', icon: 'IdCard', route: '/app/reports?tab=manuales' },
]

interface OnboardingState {
  milestones: OnboardingMilestone[]
  dismissed: boolean
  activeTooltip: string | null
  showChecklist: boolean
  pendingConfirmation: string | null

  completeMilestone: (id: string, options?: { fromDB?: boolean; companyId?: string }) => void
  requestConfirmation: (id: string) => void
  confirmAndComplete: (id: string, companyId?: string) => void
  cancelConfirmation: () => void
  dismiss: () => void
  reopen: () => void
  setActiveTooltip: (id: string | null) => void
  toggleChecklist: () => void
  resetOnboarding: () => void
  progress: () => { completed: number; total: number; percent: number }
  loadMilestonesFromDB: (companyId: string) => Promise<void>
}

/** Escribe los IDs de milestones completados en companies.milestone_completions */
async function syncMilestonesToDB(companyId: string, milestones: OnboardingMilestone[]) {
  const completedIds = milestones.filter(m => m.completed).map(m => m.id)
  const { error } = await supabase
    .from('companies')
    .update({ milestone_completions: completedIds })
    .eq('id', companyId)

  if (error) {
    console.warn('[onboardingStore] Error sincronizando milestones:', error.message)
  }
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      milestones: DEFAULT_MILESTONES.map(m => ({ ...m, completed: false })),
      dismissed: false,
      activeTooltip: null,
      showChecklist: true,
      pendingConfirmation: null,

      completeMilestone: (id, options = {}) => {
        set((s) => ({
          milestones: s.milestones.map(m =>
            m.id === id ? { ...m, completed: true } : m
          ),
        }))

        // Si viene de DB no re-escribir (evita loop)
        if (options.fromDB) return

        if (options.companyId) {
          const updatedMilestones = get().milestones.map(m =>
            m.id === id ? { ...m, completed: true } : m
          )
          void syncMilestonesToDB(options.companyId, updatedMilestones)
        }
      },

      requestConfirmation: (id) => {
        const milestone = get().milestones.find(m => m.id === id)
        if (milestone && !milestone.completed) {
          set({ pendingConfirmation: id })
        }
      },

      confirmAndComplete: (id, companyId) => {
        set((s) => ({
          milestones: s.milestones.map(m =>
            m.id === id ? { ...m, completed: true } : m
          ),
          pendingConfirmation: null,
        }))

        if (companyId) {
          const updatedMilestones = get().milestones.map(m =>
            m.id === id ? { ...m, completed: true } : m
          )
          void syncMilestonesToDB(companyId, updatedMilestones)
        }
      },

      cancelConfirmation: () => set({ pendingConfirmation: null }),

      dismiss: () => set({ dismissed: true, showChecklist: false }),
      reopen: () => set({ dismissed: false, showChecklist: true }),
      setActiveTooltip: (id) => set({ activeTooltip: id }),
      toggleChecklist: () => set((s) => ({ showChecklist: !s.showChecklist })),

      resetOnboarding: () => set({
        milestones: DEFAULT_MILESTONES.map(m => ({ ...m, completed: false })),
        dismissed: false,
        showChecklist: true,
        pendingConfirmation: null,
      }),

      progress: () => {
        const { milestones } = get()
        const completed = milestones.filter(m => m.completed).length
        return { completed, total: milestones.length, percent: Math.round((completed / milestones.length) * 100) }
      },

      loadMilestonesFromDB: async (companyId: string) => {
        const { data, error } = await supabase
          .from('companies')
          .select('milestone_completions')
          .eq('id', companyId)
          .maybeSingle()

        if (error) {
          console.warn('[onboardingStore] Error cargando milestones desde DB:', error.message)
          return
        }

        const completedIds = (data?.milestone_completions ?? []) as string[]

        // DB es fuente de verdad: aplica siempre, no hace merge con estado local.
        // Evita que milestones de empresa anterior contaminen la empresa activa.
        set((s) => ({
          milestones: s.milestones.map(m => ({
            ...m,
            completed: completedIds.includes(m.id),
          })),
        }))
      },
    }),
    {
      name: 'lean-process-onboarding',
      version: 3,
      partialize: (state) => ({
        milestones: state.milestones,
        dismissed: state.dismissed,
        showChecklist: state.showChecklist,
      }),
      migrate: identityMigration(),
      // Reconciliar contra DEFAULT_MILESTONES: conserva el estado `completed`
      // persistido pero añade los hitos nuevos (y actualiza títulos/orden), para
      // que quien ya tenía la guía vea los pasos recién agregados.
      merge: (persisted, current) => {
        const p = persisted as Partial<OnboardingState> | undefined
        const done = new Map((p?.milestones ?? []).map((m) => [m.id, m.completed]))
        const milestones = DEFAULT_MILESTONES.map((m) => ({ ...m, completed: done.get(m.id) ?? false }))
        return { ...current, ...(p as object), milestones }
      },
    }
  )
)
