import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWorkspaceStore } from './workspaceStore'
import { useChangeLogStore } from './changeLogStore'
import { useAuthStore } from './authStore'
import { toast } from './toastStore'
import { generateId } from '@/utils/id'
import { dbWrite } from '@/lib/dbWrite'
import { toRow } from './indicatorStoreUtils'

function currentCompanyId(): string | null {
  return useWorkspaceStore.getState().activeCompanyId
}

// ─── Stored indicator shape ─────────────────────────────────────────────
// Campos en inglés, alineados con la tabla public.indicators (migración
// 20260417000001_consolidate_indicators_en). Las migraciones de persist
// convierten los indicadores legacy en ES al nuevo formato.

export interface StoredIndicator {
  id: string
  process_id: string
  company_id?: string | null
  name: string
  description: string
  formula: string
  data_source: string
  unit: string
  frequency: string
  target_value: string
  threshold_green_min: number | null
  threshold_green_max: number | null
  threshold_yellow_min: number | null
  threshold_yellow_max: number | null
  threshold_red_min: number | null
  threshold_red_max: number | null
  owner: string
  reporter: string
  created_at: string
  updated_at: string
}

interface LegacyStoredIndicator {
  nombre?: string
  objetivo?: string
  formula?: string
  fuente_datos?: string
  unidad_medida?: string
  frecuencia?: string
  meta?: string
  // Campos de texto legacy (v1-v3) — descartados en migración a v4
  umbral_verde?: string
  umbral_amarillo?: string
  umbral_rojo?: string
  threshold_green?: string
  threshold_yellow?: string
  threshold_red?: string
  responsable_reporte?: string
  responsable_monitoreo?: string
}

interface IndicatorState {
  indicators: StoredIndicator[]

  getByProcess: (processId: string) => StoredIndicator[]
  addIndicator: (processId: string, data: Omit<StoredIndicator, 'id' | 'process_id' | 'created_at' | 'updated_at'>) => StoredIndicator
  addMany: (processId: string, items: Omit<StoredIndicator, 'id' | 'process_id' | 'created_at' | 'updated_at'>[]) => void
  replaceProcessIndicators: (processId: string, items: Omit<StoredIndicator, 'id' | 'process_id' | 'created_at' | 'updated_at'>[]) => void
  updateIndicator: (id: string, updates: Partial<StoredIndicator>) => void
  removeIndicator: (id: string) => void
  clearProcess: (processId: string) => void
  clearCompanyData: (companyId: string) => void
  loadFromDB: (companyId: string) => Promise<void>
}

export const useIndicatorStore = create<IndicatorState>()(
  persist(
    (set, get) => ({
      indicators: [],

      getByProcess: (processId: string) => {
        return get().indicators.filter(i => i.process_id === processId)
      },

      addIndicator: (processId, data) => {
        const now = new Date().toISOString()
        const companyId = currentCompanyId()
        const indicator: StoredIndicator = { ...data, id: generateId(), process_id: processId, company_id: companyId, created_at: now, updated_at: now }
        const prev = get().indicators
        set(s => ({ indicators: [...s.indicators, indicator] }))
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({ process_id: processId, action: 'kpis_defined', description: `Indicador "${data.name}" definido`, author })
        void (async () => {
          const { createIndicator } = await import('@/services/indicators.service')
          await dbWrite(
            'indicator:addIndicator',
            createIndicator(toRow(indicator) as unknown as Parameters<typeof createIndicator>[0]),
            {
              successMessage: 'Indicador guardado.',
              errorMessage: 'No se pudo guardar el indicador en la nube.',
              rollback: () => set({ indicators: prev }),
            }
          )
        })()
        return indicator
      },

      addMany: (processId, items) => {
        const now = new Date().toISOString()
        const companyId = currentCompanyId()
        const newIndicators: StoredIndicator[] = items.map(item => ({ ...item, id: generateId(), process_id: processId, company_id: companyId, created_at: now, updated_at: now }))
        const prev = get().indicators
        set(s => ({ indicators: [...s.indicators, ...newIndicators] }))
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({ process_id: processId, action: 'kpis_defined', description: `${items.length} indicador(es) KPI definidos`, author })
        void (async () => {
          const { createIndicator } = await import('@/services/indicators.service')
          const results = await Promise.all(
            newIndicators.map((ind) =>
              dbWrite(
                'indicator:addMany',
                createIndicator(toRow(ind) as unknown as Parameters<typeof createIndicator>[0]),
                { silent: true }
              )
            )
          )
          if (results.some((r) => !r.ok)) {
            toast.error('Algunos indicadores no se pudieron guardar. Revisa tu conexión.')
            set({ indicators: prev })
          }
        })()
      },

      // Reemplaza atómicamente los indicadores de un proceso: borra y luego
      // inserta dentro de una sola IIFE, evitando la race condition que ocurre
      // al combinar clearProcess + addMany (mismo patrón que valueAnalysisStore).
      replaceProcessIndicators: (processId, items) => {
        const now = new Date().toISOString()
        const companyId = currentCompanyId()
        const newIndicators: StoredIndicator[] = items.map(item => ({ ...item, id: generateId(), process_id: processId, company_id: companyId, created_at: now, updated_at: now }))
        const prev = get().indicators
        set(s => ({ indicators: [...s.indicators.filter(i => i.process_id !== processId), ...newIndicators] }))
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({ process_id: processId, action: 'kpis_defined', description: `${items.length} indicador(es) KPI definidos`, author })
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          const delResult = await dbWrite('indicator:replace:delete', supabase.from('indicators').delete().eq('process_id', processId), { errorMessage: 'No se pudo actualizar los indicadores.', rollback: () => set({ indicators: prev }) })
          if (!delResult.ok) return
          if (newIndicators.length === 0) { toast.success('Indicadores actualizados.'); return }
          const { createIndicator } = await import('@/services/indicators.service')
          const results = await Promise.all(newIndicators.map((ind) => dbWrite('indicator:replace:insert', createIndicator(toRow(ind) as unknown as Parameters<typeof createIndicator>[0]), { silent: true })))
          if (results.some((r) => !r.ok)) {
            toast.error('Algunos indicadores no se pudieron guardar. Revisa tu conexión.')
            set({ indicators: prev })
          } else {
            toast.success(`${newIndicators.length} indicador(es) guardados.`)
          }
        })()
      },

      updateIndicator: (id, updates) => {
        const prev = get().indicators
        set(s => ({
          indicators: s.indicators.map(i =>
            i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i
          ),
        }))
        const current = get().indicators.find(i => i.id === id)
        if (!current) return
        void (async () => {
          const { updateIndicator: updateInDB } = await import('@/services/indicators.service')
          await dbWrite(
            'indicator:updateIndicator',
            updateInDB(id, toRow({ ...current, ...updates } as StoredIndicator) as unknown as Parameters<typeof updateInDB>[1]),
            {
              silent: true,
              errorMessage: 'No se pudo actualizar el indicador.',
              rollback: () => set({ indicators: prev }),
            }
          )
        })()
      },

      removeIndicator: (id) => {
        const prev = get().indicators
        set(s => ({ indicators: s.indicators.filter(i => i.id !== id) }))
        void (async () => {
          const { deleteIndicator } = await import('@/services/indicators.service')
          await dbWrite(
            'indicator:removeIndicator',
            deleteIndicator(id),
            {
              successMessage: 'Indicador eliminado.',
              errorMessage: 'No se pudo eliminar el indicador.',
              rollback: () => set({ indicators: prev }),
            }
          )
        })()
      },

      clearCompanyData: (companyId) =>
        set((s) => ({ indicators: s.indicators.filter((i) => i.company_id !== companyId) })),

      clearProcess: (processId) => {
        const prev = get().indicators
        set(s => ({ indicators: s.indicators.filter(i => i.process_id !== processId) }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'indicator:clearProcess',
            supabase.from('indicators').delete().eq('process_id', processId),
            {
              successMessage: 'Indicadores eliminados.',
              errorMessage: 'No se pudieron limpiar los indicadores del proceso.',
              rollback: () => set({ indicators: prev }),
            }
          )
        })()
      },

      loadFromDB: async (companyId) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('indicators')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at')
          if (error || !data) return
          const mapped: StoredIndicator[] = data.map((r) => {
            return {
              id: r.id,
              process_id: r.process_id ?? '',
              company_id: r.company_id,
              name: r.name ?? '',
              description: r.description ?? '',
              formula: r.formula ?? '',
              data_source: r.data_source ?? '',
              unit: r.unit ?? '',
              frequency: r.frequency ?? '',
              target_value: r.target_value == null ? '' : String(r.target_value),
              threshold_green_min: (r as Record<string, unknown>).threshold_green_min as number | null ?? null,
              threshold_green_max: (r as Record<string, unknown>).threshold_green_max as number | null ?? null,
              threshold_yellow_min: (r as Record<string, unknown>).threshold_yellow_min as number | null ?? null,
              threshold_yellow_max: (r as Record<string, unknown>).threshold_yellow_max as number | null ?? null,
              threshold_red_min: (r as Record<string, unknown>).threshold_red_min as number | null ?? null,
              threshold_red_max: (r as Record<string, unknown>).threshold_red_max as number | null ?? null,
              owner: r.owner ?? '',
              reporter: r.reporter ?? '',
              created_at: r.created_at,
              updated_at: r.updated_at,
            }
          })
          set({ indicators: mapped })
        } catch { /* silent */ }
      },
    }),
    {
      name: 'lean-process-indicators',
      version: 4,
      partialize: (state) => ({ indicators: state.indicators }),
      migrate: (persisted) => {
        const raw = (persisted as { indicators?: Array<Partial<StoredIndicator> & LegacyStoredIndicator> }) ?? {}
        const list: StoredIndicator[] = Array.isArray(raw.indicators)
          ? raw.indicators.map((ind) => ({
              id: String(ind.id ?? ''),
              process_id: String(ind.process_id ?? ''),
              company_id: ind.company_id ?? null,
              created_at: String(ind.created_at ?? new Date().toISOString()),
              updated_at: String(ind.updated_at ?? new Date().toISOString()),
              name: ind.name || ind.nombre || '',
              description: ind.description || ind.objetivo || '',
              formula: ind.formula || '',
              data_source: ind.data_source || ind.fuente_datos || '',
              unit: ind.unit || ind.unidad_medida || '',
              frequency: ind.frequency || ind.frecuencia || '',
              target_value: ind.target_value || ind.meta || '',
              // Los umbrales texto legacy no son parseables de forma confiable → reset a null
              threshold_green_min: null,
              threshold_green_max: null,
              threshold_yellow_min: null,
              threshold_yellow_max: null,
              threshold_red_min: null,
              threshold_red_max: null,
              owner: ind.owner || ind.responsable_reporte || '',
              reporter: ind.reporter || ind.responsable_monitoreo || '',
            }))
          : []
        return { indicators: list }
      },
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
