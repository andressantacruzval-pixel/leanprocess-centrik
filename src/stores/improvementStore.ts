import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'
import { useWorkspaceStore } from './workspaceStore'
import { useAuthStore } from './authStore'
import { useChangeLogStore } from './changeLogStore'
import type { Database } from '@/types/database'
import type { ImprovementOpportunity, ImprovementStatus, ScoreValue, ImprovementMilestone } from '@/types/improvement'
import { clampScore } from '@/types/improvement'

type Row = Database['public']['Tables']['improvement_opportunities']['Row']
type Insert = Database['public']['Tables']['improvement_opportunities']['Insert']

/** Datos que la IA propone para una oportunidad nueva. */
export interface AiImprovementInput {
  name: string
  description: string
  costScore: ScoreValue
  complexityScore: ScoreValue
  timeScore: ScoreValue
}

interface ImprovementState {
  opportunities: ImprovementOpportunity[]
  getByProcess: (processId: string) => ImprovementOpportunity[]
  addOpportunity: (processId: string, partial?: Partial<ImprovementOpportunity>) => ImprovementOpportunity
  importAiOpportunities: (processId: string, items: AiImprovementInput[]) => void
  updateOpportunity: (id: string, updates: Partial<ImprovementOpportunity>) => void
  deleteOpportunity: (id: string) => void
  clearCompanyData: (companyId: string) => void
  loadFromDB: (companyId: string) => Promise<void>
}

function rowToApp(r: Row): ImprovementOpportunity {
  return {
    id: r.id,
    processId: r.process_id,
    companyId: r.company_id,
    name: r.name,
    description: r.description ?? '',
    milestones: Array.isArray(r.milestones) ? (r.milestones as unknown as ImprovementMilestone[]) : [],
    costScore: clampScore(r.cost_score),
    complexityScore: clampScore(r.complexity_score),
    timeScore: clampScore(r.time_score),
    responsible: r.responsible ?? '',
    startDate: r.start_date,
    endDate: r.end_date,
    status: (r.status as ImprovementStatus) ?? 'propuesta',
    progressNotes: r.progress_notes ?? '',
    progressPct: r.progress_pct ?? 0,
    closeDate: r.close_date,
    createdAt: r.created_at,
  }
}

function appToRow(o: ImprovementOpportunity): Insert {
  return {
    id: o.id,
    company_id: o.companyId,
    process_id: o.processId,
    name: o.name,
    description: o.description,
    milestones: o.milestones as unknown as Insert['milestones'],
    cost_score: o.costScore,
    complexity_score: o.complexityScore,
    time_score: o.timeScore,
    responsible: o.responsible || null,
    start_date: o.startDate,
    end_date: o.endDate,
    status: o.status,
    progress_notes: o.progressNotes,
    progress_pct: o.progressPct,
    close_date: o.closeDate,
  }
}

function newOpportunity(processId: string, companyId: string, partial?: Partial<ImprovementOpportunity>): ImprovementOpportunity {
  return {
    id: generateId(),
    processId,
    companyId,
    name: partial?.name ?? 'Nueva oportunidad de mejora',
    description: partial?.description ?? '',
    milestones: partial?.milestones ?? [],
    costScore: partial?.costScore ?? 3,
    complexityScore: partial?.complexityScore ?? 3,
    timeScore: partial?.timeScore ?? 3,
    responsible: partial?.responsible ?? '',
    startDate: partial?.startDate ?? null,
    endDate: partial?.endDate ?? null,
    status: partial?.status ?? 'propuesta',
    progressNotes: partial?.progressNotes ?? '',
    progressPct: partial?.progressPct ?? 0,
    closeDate: partial?.closeDate ?? null,
    createdAt: new Date().toISOString(),
  }
}

export const useImprovementStore = create<ImprovementState>()(
  persist(
    (set, get) => ({
      opportunities: [],

      getByProcess: (processId) => get().opportunities.filter((o) => o.processId === processId),

      addOpportunity: (processId, partial) => {
        const companyId = useWorkspaceStore.getState().activeCompanyId
        const created = newOpportunity(processId, companyId ?? '', partial)
        const prev = get().opportunities
        set({ opportunities: [...prev, created] })
        if (companyId) {
          void dbWrite(
            'improvement:insert',
            supabase.from('improvement_opportunities').insert(appToRow(created)),
            { errorMessage: 'No se pudo guardar la oportunidad de mejora.', rollback: () => set({ opportunities: prev }) }
          )
        }
        return created
      },

      importAiOpportunities: (processId, items) => {
        const companyId = useWorkspaceStore.getState().activeCompanyId
        if (!companyId || items.length === 0) return
        const created = items.map((it) => newOpportunity(processId, companyId, {
          name: it.name,
          description: it.description,
          costScore: it.costScore,
          complexityScore: it.complexityScore,
          timeScore: it.timeScore,
        }))
        const prev = get().opportunities
        set({ opportunities: [...prev, ...created] })
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({
          process_id: processId,
          action: 'value_analyzed',
          description: `IA identificó ${created.length} oportunidad(es) de mejora`,
          author,
        })
        void dbWrite(
          'improvement:import',
          supabase.from('improvement_opportunities').insert(created.map(appToRow)),
          { successMessage: 'Oportunidades de mejora guardadas.', errorMessage: 'No se pudieron guardar las oportunidades.', rollback: () => set({ opportunities: prev }) }
        )
      },

      updateOpportunity: (id, updates) => {
        const prev = get().opportunities
        const next = prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
        set({ opportunities: next })
        const target = next.find((o) => o.id === id)
        if (!target) return
        void dbWrite(
          'improvement:update',
          supabase.from('improvement_opportunities').update(appToRow(target)).eq('id', id),
          { errorMessage: 'No se pudo actualizar la oportunidad.', rollback: () => set({ opportunities: prev }) }
        )
      },

      deleteOpportunity: (id) => {
        const prev = get().opportunities
        set({ opportunities: prev.filter((o) => o.id !== id) })
        void dbWrite(
          'improvement:delete',
          supabase.from('improvement_opportunities').delete().eq('id', id),
          { errorMessage: 'No se pudo eliminar la oportunidad.', rollback: () => set({ opportunities: prev }) }
        )
      },

      clearCompanyData: (companyId) => {
        set({ opportunities: get().opportunities.filter((o) => o.companyId !== companyId) })
      },

      loadFromDB: async (companyId) => {
        const { data, error } = await supabase
          .from('improvement_opportunities')
          .select('*')
          .eq('company_id', companyId)
        if (error) {
          console.warn('[improvementStore] loadFromDB error:', error.message)
          return
        }
        const loaded = (data ?? []).map(rowToApp)
        // Conservar oportunidades de otras empresas ya en memoria.
        const others = get().opportunities.filter((o) => o.companyId !== companyId)
        set({ opportunities: [...others, ...loaded] })
      },
    }),
    {
      name: 'lean-process-improvements',
      version: 1,
      migrate: identityMigration,
    }
  )
)
