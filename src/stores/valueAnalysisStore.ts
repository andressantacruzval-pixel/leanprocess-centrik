import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ValueActivity } from '@/utils/valueAnalysis'
import { normalizeToDailyMinutes } from '@/utils/valueAnalysis'
import { generateId } from '@/utils/id'
import { useChangeLogStore } from './changeLogStore'
import { useAuthStore } from './authStore'
import { useWorkspaceStore } from './workspaceStore'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

interface ValueAnalysisState {
  // processId → activities
  analyses: Record<string, ValueActivity[]>

  setActivities: (processId: string, activities: ValueActivity[]) => void
  updateActivity: (processId: string, activityId: string, updates: Partial<Pick<ValueActivity, 'classification' | 'frequency' | 'timePerOccurrence' | 'occurrences'>>) => void
  removeActivity: (processId: string, activityId: string) => void
  syncFromBpmn: (processId: string, bpmnActivities: { id: string; name: string; laneName?: string }[]) => void
  clearProcesses: (processIds: string[]) => void
  loadFromDB: (companyId: string) => Promise<void>
}

function recomputeDaily(a: ValueActivity): ValueActivity {
  return { ...a, dailyMinutes: normalizeToDailyMinutes(a.timePerOccurrence, a.occurrences, a.frequency) }
}

export const useValueAnalysisStore = create<ValueAnalysisState>()(
  persist(
    (set, get) => ({
      analyses: {},

      setActivities: (processId, activities) => {
        const computed = activities.map(recomputeDaily)
        const prev = get().analyses
        set((s) => ({ analyses: { ...s.analyses, [processId]: computed } }))
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({
          process_id: processId,
          action: 'value_analyzed',
          description: `Analisis de valor con ${activities.length} actividad(es)`,
          author,
        })
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          const delResult = await dbWrite(
            'valueAnalysis:replace:delete',
            supabase.from('value_activities').delete().eq('process_id', processId),
            {
              errorMessage: 'No se pudo actualizar el análisis de valor.',
              rollback: () => set({ analyses: prev }),
            }
          )
          if (!delResult.ok || computed.length === 0) return
          const companyId = useWorkspaceStore.getState().activeCompanyId
          if (!companyId) return
          // Mapeo ValueActivity → columnas. CHECK alineado a VA/NVA/NVABN desde migración 20260417000005.
          // id es UUID (PK); bpmn_node_id referencia el nodo del diagrama (migración 20260418000002).
          const rows = computed.map((a, idx) => ({
            id: a.id,
            bpmn_node_id: a.bpmnNodeId,
            process_id: processId,
            company_id: companyId,
            name: a.name,
            value_type: a.classification ?? 'NVA',
            time_minutes: Math.round(a.dailyMinutes ?? 0),
            cost: 0,
            sequence: idx,
            notes: a.laneName ?? null,
          }))
          await dbWrite(
            'valueAnalysis:replace:insert',
            supabase.from('value_activities').insert(rows),
            {
              successMessage: 'Análisis de valor guardado.',
              errorMessage: 'No se pudieron guardar las actividades del análisis de valor.',
              rollback: () => set({ analyses: prev }),
            }
          )
        })()
      },

      updateActivity: (processId, activityId, updates) => {
        const prev = get().analyses
        set((s) => {
          const current = s.analyses[processId] || []
          const updated = current.map((a) => {
            if (a.id !== activityId) return a
            return recomputeDaily({ ...a, ...updates })
          })
          return { analyses: { ...s.analyses, [processId]: updated } }
        })
        void (async () => {
          const dbUpdates: { value_type?: string; time_minutes?: number } = {}
          if (updates.classification !== undefined) {
            dbUpdates.value_type = updates.classification ?? 'NVA'
          }
          if (updates.timePerOccurrence !== undefined || updates.occurrences !== undefined || updates.frequency !== undefined) {
            const activity = (get().analyses[processId] ?? []).find((a) => a.id === activityId)
            if (activity) dbUpdates.time_minutes = Math.round(activity.dailyMinutes ?? 0)
          }
          if (Object.keys(dbUpdates).length === 0) return
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'valueAnalysis:updateActivity',
            supabase.from('value_activities').update(dbUpdates).eq('id', activityId),
            {
              successMessage: 'Actividad actualizada.',
              errorMessage: 'No se pudo actualizar la actividad.',
              rollback: () => set({ analyses: prev }),
            }
          )
        })()
      },

      removeActivity: (processId, activityId) => {
        const prev = get().analyses
        set((s) => {
          const current = s.analyses[processId] || []
          return { analyses: { ...s.analyses, [processId]: current.filter((a) => a.id !== activityId) } }
        })
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'valueAnalysis:removeActivity',
            supabase.from('value_activities').delete().eq('id', activityId),
            {
              successMessage: 'Actividad eliminada.',
              errorMessage: 'No se pudo eliminar la actividad.',
              rollback: () => set({ analyses: prev }),
            }
          )
        })()
      },

      clearProcesses: (processIds) => {
        const idSet = new Set(processIds)
        set((s) => {
          const updated = { ...s.analyses }
          idSet.forEach((id) => { delete updated[id] })
          return { analyses: updated }
        })
      },

      loadFromDB: async (companyId) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('value_activities')
            .select('id, bpmn_node_id, process_id, name, value_type, time_minutes, sequence, notes')
            .eq('company_id', companyId)
            .order('sequence')
          if (error || !data) return
          const next: Record<string, ValueActivity[]> = {}
          for (const row of data) {
            const list = next[row.process_id] ?? (next[row.process_id] = [])
            list.push({
              id: row.id,
              bpmnNodeId: row.bpmn_node_id ?? row.id,
              name: row.name,
              laneName: row.notes ?? undefined,
              classification: (row.value_type as ValueActivity['classification']) ?? null,
              frequency: 'diaria',
              timePerOccurrence: row.time_minutes,
              occurrences: 1,
              dailyMinutes: row.time_minutes,
            })
          }
          set({ analyses: next })
        } catch (err) {
          console.warn('[valueAnalysisStore] Error cargando análisis de valor desde DB:', err)
        }
      },

      // Sync activities from BPMN: add new nodes, remove deleted ones, keep existing data.
      // El mapping es por bpmnNodeId (ej: "Task_5") — el id interno es UUID de DB.
      syncFromBpmn: (processId, bpmnActivities) => {
        set((s) => {
          const current = s.analyses[processId] || []
          const existingMap = new Map(current.map((a) => [a.bpmnNodeId, a]))

          const synced: ValueActivity[] = bpmnActivities.map((b) => {
            const existing = existingMap.get(b.id)
            if (existing) {
              return { ...existing, name: b.name, laneName: b.laneName }
            }
            return recomputeDaily({
              id: generateId(),
              bpmnNodeId: b.id,
              name: b.name,
              laneName: b.laneName,
              classification: null,
              frequency: 'diaria',
              timePerOccurrence: 0,
              occurrences: 1,
              dailyMinutes: 0,
            })
          })

          return { analyses: { ...s.analyses, [processId]: synced } }
        })
      },
    }),
    {
      name: 'lean-process-value-analysis',
      version: 1,
      partialize: (state) => ({ analyses: state.analyses }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
