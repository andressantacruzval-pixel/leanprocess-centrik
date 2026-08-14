import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

export type ChangeAction =
  | 'created'
  | 'bpmn_updated'
  | 'procedure_generated'
  | 'risks_identified'
  | 'kpis_defined'
  | 'audit_created'
  | 'value_analyzed'
  | 'manual_edit'

export interface ChangeLogEntry {
  id: string
  process_id: string
  timestamp: number
  action: ChangeAction
  description: string
  author: string
}

/** Lo que sabemos del historial remoto de UN proceso. Vive solo en memoria. */
export interface PaginaHistorial {
  /** Ya se pidio al menos una pagina. */
  cargado: boolean
  cargando: boolean
  /** El servidor devolvio menos de los pedidos: no hay mas que traer. */
  completo: boolean
}

interface ChangeLogState {
  entries: ChangeLogEntry[]
  /** Estado de paginacion por proceso. NO se persiste: al refrescar se vuelve a pedir. */
  paginas: Record<string, PaginaHistorial>

  addEntry: (entry: Omit<ChangeLogEntry, 'id' | 'timestamp'>) => void
  getEntriesByProcess: (processId: string) => ChangeLogEntry[]
  /** Elimina entradas con más de 90 días de antigüedad */
  purgeOldEntries: () => number
  clearProcesses: (processIds: string[]) => void
  /**
   * Trae la siguiente pagina del historial de UN proceso.
   *
   * Sustituye a la carga global de 500 filas por empresa, que era desproporcionada
   * y ademas MENTIA: Marsacot tiene 1.289 entradas, se traian 500 y las otras 789
   * desaparecian sin que nada lo dijera. El historial se veia completo y no lo estaba.
   *
   * Como solo se pide al abrir la pestaña, y solo del proceso abierto, el caso
   * normal pasa de 500 filas a 50. Lo ya traido se queda en memoria: moverse entre
   * paginas no vuelve a consultar. Al refrescar se pide de nuevo, que es justo lo
   * que se quiere de una cache de sesion.
   */
  cargarHistorial: (processId: string) => Promise<void>
}

const MAX_ENTRIES_PER_PROCESS = 100

/** Cuantas entradas trae cada «ver mas». */
export const PAGINA_HISTORIAL = 50

export const useChangeLogStore = create<ChangeLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      paginas: {},

      addEntry: (entry) => {
        const newEntry: ChangeLogEntry = {
          ...entry,
          id: generateId(),
          timestamp: Date.now(),
        }
        set((s) => {
          const updated = [newEntry, ...s.entries]
          // Enforce max 100 per process: count entries for this process
          let count = 0
          const trimmed = updated.filter((e) => {
            if (e.process_id !== entry.process_id) return true
            count++
            return count <= MAX_ENTRIES_PER_PROCESS
          })
          return { entries: trimmed }
        })
        // changelog es alta frecuencia + no-crítico: silent. Sin rollback porque
        // perder una entrada de changelog no degrada la experiencia real del usuario.
        void (async () => {
          const [{ addEntry: addInDB }, { useAuthStore }, { useWorkspaceStore }] = await Promise.all([
            import('@/services/changeLog.service'),
            import('@/stores/authStore'),
            import('@/stores/workspaceStore'),
          ])
          const userId = useAuthStore.getState().user?.id ?? ''
          const companyId = useWorkspaceStore.getState().activeCompanyId ?? ''
          await dbWrite(
            'changeLog:addEntry',
            addInDB({
              process_id: entry.process_id,
              company_id: companyId,
              user_id: userId,
              action: entry.action,
              description: entry.description,
              author_name: entry.author ?? 'Sistema',
            }),
            { silent: true }
          )
        })()
      },

      getEntriesByProcess: (processId) => {
        return get()
          .entries.filter((e) => e.process_id === processId)
          .sort((a, b) => b.timestamp - a.timestamp)
      },

      purgeOldEntries: () => {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
        const before = get().entries.length
        set((s) => ({ entries: s.entries.filter((e) => e.timestamp >= cutoff) }))
        return before - get().entries.length
      },

      clearProcesses: (processIds) => {
        const idSet = new Set(processIds)
        set((s) => ({ entries: s.entries.filter((e) => !idSet.has(e.process_id)) }))
      },

      cargarHistorial: async (processId) => {
        const pagina = get().paginas[processId]
        if (pagina?.cargando || pagina?.completo) return

        set((s) => ({
          paginas: { ...s.paginas, [processId]: { cargado: true, cargando: true, completo: false } },
        }))

        try {
          const { supabase } = await import('@/lib/supabase')
          // Se cuenta lo que YA hay de este proceso para saber desde donde seguir.
          const yaTengo = get().entries.filter((e) => e.process_id === processId).length
          const { data, error } = await supabase
            .from('change_log')
            .select('id, process_id, action, description, author_name, created_at')
            .eq('process_id', processId)
            .order('created_at', { ascending: false })
            .range(yaTengo, yaTengo + PAGINA_HISTORIAL - 1)

          if (error || !data) {
            set((s) => ({
              paginas: { ...s.paginas, [processId]: { cargado: true, cargando: false, completo: false } },
            }))
            return
          }

          const traidas: ChangeLogEntry[] = data.map((r) => ({
            id: r.id,
            process_id: r.process_id,
            timestamp: new Date(r.created_at).getTime(),
            action: (r.action as ChangeAction) ?? 'manual_edit',
            description: r.description ?? '',
            author: r.author_name ?? 'Sistema',
          }))

          set((s) => {
            // Las locales (recien escritas por `addEntry`) pueden coincidir con las
            // remotas: se deduplica por id para no pintar la misma dos veces.
            const conocidos = new Set(s.entries.map((e) => e.id))
            const nuevas = traidas.filter((e) => !conocidos.has(e.id))
            return {
              entries: [...s.entries, ...nuevas].sort((a, b) => b.timestamp - a.timestamp),
              paginas: {
                ...s.paginas,
                [processId]: {
                  cargado: true,
                  cargando: false,
                  // Menos de los pedidos = se acabo. Es la unica señal fiable de fin.
                  completo: data.length < PAGINA_HISTORIAL,
                },
              },
            }
          })
        } catch {
          set((s) => ({
            paginas: { ...s.paginas, [processId]: { cargado: true, cargando: false, completo: false } },
          }))
        }
      },
    }),
    {
      name: 'lean-process-changelog',
      version: 1,
      partialize: (state) => ({ entries: state.entries }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
