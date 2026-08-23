import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Macroprocess, Process, ProcessLevelDefinition } from '@/types'
import { useWorkspaceStore } from './workspaceStore'
import { useChangeLogStore } from './changeLogStore'
import { useAuthStore } from './authStore'
import { toast } from './toastStore'
import { supabase } from '@/lib/supabase'
import { MacroprocessSchema, ProcessSchema } from '@/lib/schemas/process.schema'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

// Helper: lee la empresa activa en tiempo de creacion para scopear data.
function currentCompanyId(): string | null {
  return useWorkspaceStore.getState().activeCompanyId
}

// Helper: dueño (auth.users) del registro. La RLS de `macroprocesses` y
// `processes` exige `auth.uid() = user_id` al INSERT; sin esto la fila se
// rechaza y el volcado sube "unos sí y otros no".
function currentUserId(): string {
  const a = useAuthStore.getState()
  return a.user?.id ?? a.profile?.id ?? ''
}

interface ProcessState {
  macroprocesses: Macroprocess[]
  processes: Process[]
  levelDefinitions: ProcessLevelDefinition[]
  selectedProcess: Process | null

  // Setters
  setMacroprocesses: (m: Macroprocess[]) => void
  setProcesses: (p: Process[]) => void
  setLevelDefinitions: (l: ProcessLevelDefinition[]) => void
  setSelectedProcess: (p: Process | null) => void

  // Macroprocess CRUD
  addMacroprocess: (name: string, category: 'estrategico' | 'productivo' | 'apoyo') => Macroprocess
  updateMacroprocess: (id: string, updates: Partial<Macroprocess>) => void
  deleteMacroprocess: (id: string) => void
  reorderMacroprocesses: (category: string, ids: string[]) => void
  moveMacroprocessCategory: (id: string, newCategory: 'estrategico' | 'productivo' | 'apoyo') => void

  // Process CRUD
  addProcess: (name: string, macroprocessId: string, parentProcessId?: string | null) => Process
  /**
   * Alta en lote (padres antes que hijos). Persiste EN ORDEN y esperando cada
   * INSERT, para que un subproceso no viole la FK a su proceso padre aún no
   * confirmado. Devuelve cuántos se crearon y cuántos fallaron.
   */
  bulkAddProcesses: (procs: Process[]) => Promise<{ ok: number; failed: number }>
  updateProcess: (id: string, updates: Partial<Process>) => void
  /**
   * Propaga el renombre de una unidad organizacional a los procesos que la
   * referencian. Los campos `management`/`coordination`/`operative` guardan el
   * NOMBRE de la unidad (no su id), así que al renombrar en el organigrama hay
   * que actualizar en cascada o quedan valores obsoletos en los filtros.
   */
  renameOrgReference: (field: 'management' | 'coordination' | 'operative', oldName: string, newName: string) => void
  /**
   * Limpia el nombre de una unidad organizacional eliminada de los procesos que
   * la referenciaban. Sin esto, el nombre borrado del organigrama sobrevive en
   * `management`/`coordination`/`operative` y sigue apareciendo en los catálogos
   * y filtros (que unen las unidades vivas con los valores de los procesos).
   */
  clearOrgReference: (field: 'management' | 'coordination' | 'operative', names: string[]) => void
  /** `silent` evita el toast por proceso: lo usa el borrado múltiple, que da un único resumen. */
  deleteProcess: (id: string, opts?: { silent?: boolean }) => void
  reorderProcesses: (parentId: string | null, macroId: string, orderedIds: string[]) => void

  // Queries
  getProcessesByMacroprocess: (macroId: string) => Process[]
  getChildProcesses: (parentId: string) => Process[]
  getProcessesByLevel: (level: number) => Process[]

  // Limpieza local al reiniciar empresa — retorna los processIds eliminados
  clearCompanyData: (companyId: string) => string[]

  // DB sync
  loadFromDB: (companyId: string) => Promise<void>
  syncToDB: (companyId: string) => Promise<void>
}

export const useProcessStore = create<ProcessState>()(
  persist(
    (set, get) => ({
      macroprocesses: [],
      processes: [],
      levelDefinitions: [],
      selectedProcess: null,

      setMacroprocesses: (macroprocesses) => set({ macroprocesses }),
      setProcesses: (processes) => set({ processes }),
      setLevelDefinitions: (levelDefinitions) => set({ levelDefinitions }),
      setSelectedProcess: (selectedProcess) => set({ selectedProcess }),

      // --- Macroprocess CRUD ---
      addMacroprocess: (name, category) => {
        const now = new Date().toISOString()
        const existing = get().macroprocesses.filter((m) => m.category === category)
        const macro: Macroprocess = {
          id: generateId(),
          user_id: currentUserId(),
          company_id: currentCompanyId() ?? '',
          name,
          category,
          sort_order: existing.length,
          created_at: now,
          updated_at: now,
        }
        const prev = get().macroprocesses
        set((s) => ({ macroprocesses: [...s.macroprocesses, macro] }))
        void (async () => {
          const { createMacroprocess } = await import('@/services/processes.service')
          await dbWrite(
            'process:createMacroprocess',
            createMacroprocess(macro as never),
            {
              successMessage: 'Macroproceso creado.',
              errorMessage: 'No se pudo guardar el macroproceso en la nube.',
              rollback: () => set({ macroprocesses: prev }),
            }
          )
        })()
        return macro
      },

      updateMacroprocess: (id, updates) => {
        const prev = get().macroprocesses
        set((s) => ({
          macroprocesses: s.macroprocesses.map((m) =>
            m.id === id ? { ...m, ...updates, updated_at: new Date().toISOString() } : m
          ),
        }))
        void (async () => {
          const { updateMacroprocess: updateInDB } = await import('@/services/processes.service')
          await dbWrite(
            'process:updateMacroprocess',
            updateInDB(id, updates as never),
            {
              successMessage: 'Macroproceso actualizado.',
              errorMessage: 'No se pudo actualizar el macroproceso.',
              rollback: () => set({ macroprocesses: prev }),
            }
          )
        })()
      },

      deleteMacroprocess: (id) => {
        const processIds = get()
          .processes.filter((p) => p.macroprocess_id === id)
          .map((p) => p.id)
        // Cascade: collect all descendant process ids
        const allIds = new Set<string>(processIds)
        let frontier = [...processIds]
        while (frontier.length > 0) {
          const children = get()
            .processes.filter((p) => p.parent_process_id && frontier.includes(p.parent_process_id))
            .map((p) => p.id)
          children.forEach((c) => allIds.add(c))
          frontier = children
        }
        const prev = { macroprocesses: get().macroprocesses, processes: get().processes }
        set((s) => ({
          macroprocesses: s.macroprocesses.filter((m) => m.id !== id),
          processes: s.processes.filter((p) => !allIds.has(p.id)),
        }))
        void (async () => {
          const { deleteMacroprocess: deleteInDB } = await import('@/services/processes.service')
          await dbWrite(
            'process:deleteMacroprocess',
            deleteInDB(id),
            {
              successMessage: 'Macroproceso eliminado.',
              errorMessage: 'No se pudo eliminar el macroproceso.',
              rollback: () => set(prev),
            }
          )
        })()
      },

      reorderMacroprocesses: (category, ids) => {
        set((s) => ({
          macroprocesses: s.macroprocesses.map((m) => {
            if (m.category !== category) return m
            const idx = ids.indexOf(m.id)
            return idx >= 0 ? { ...m, sort_order: idx } : m
          }),
        }))
        // Persistir nuevos sort_order en Supabase (fire-and-forget)
        import('@/lib/supabase').then(({ supabase }) => {
          ids.forEach((macroId, idx) => {
            supabase.from('macroprocesses').update({ sort_order: idx }).eq('id', macroId).then(({ error }) => {
              if (error) console.warn('[processStore] Error reordenando macroproceso:', error.message)
            })
          })
        })
      },

      moveMacroprocessCategory: (id, newCategory) => {
        set((s) => {
          const macro = s.macroprocesses.find((m) => m.id === id)
          if (!macro || macro.category === newCategory) return s
          const oldCategory = macro.category
          const targetCount = s.macroprocesses.filter(
            (m) => m.category === newCategory
          ).length
          return {
            macroprocesses: s.macroprocesses.map((m) => {
              if (m.id === id) {
                return {
                  ...m,
                  category: newCategory,
                  sort_order: targetCount,
                  updated_at: new Date().toISOString(),
                }
              }
              // Re-index old category to close gaps
              if (m.category === oldCategory && m.sort_order > macro.sort_order) {
                return { ...m, sort_order: m.sort_order - 1 }
              }
              return m
            }),
          }
        })
        toast.success('Macroproceso movido exitosamente')
        // Persistir categoría actualizada en Supabase (fire-and-forget)
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.from('macroprocesses')
            .update({ category: newCategory, updated_at: new Date().toISOString() })
            .eq('id', id)
            .then(({ error }) => {
              if (error) console.warn('[processStore] Error moviendo categoría macroproceso:', error.message)
            })
        })
      },

      // --- Process CRUD ---
      addProcess: (name, macroprocessId, parentProcessId = null) => {
        const now = new Date().toISOString()
        const siblings = parentProcessId
          ? get().processes.filter((p) => p.parent_process_id === parentProcessId)
          : get().processes.filter(
              (p) => p.macroprocess_id === macroprocessId && !p.parent_process_id
            )
        const proc: Process = {
          id: generateId(),
          user_id: currentUserId(),
          company_id: currentCompanyId() ?? '',
          macroprocess_id: macroprocessId,
          parent_process_id: parentProcessId,
          name,
          is_critical: false,
          has_contingency_plan: false,
          involves_cash_movement: false,
          has_tax_operations: false,
          affects_accounting: false,
          handles_personal_data: false,
          provided_by_third_party: false,
          sort_order: siblings.length,
          created_at: now,
          updated_at: now,
        }
        const prev = get().processes
        set((s) => ({ processes: [...s.processes, proc] }))
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        void (async () => {
          const { createProcess } = await import('@/services/processes.service')
          const result = await dbWrite(
            'process:createProcess',
            createProcess(proc as never),
            {
              successMessage: 'Proceso creado.',
              errorMessage: 'No se pudo guardar el proceso en la nube.',
              rollback: () => set({ processes: prev }),
            }
          )
          if (result.ok) {
            // change_log solo se inserta cuando el proceso ya existe en DB
            // (evita FK violation en change_log.process_id_fkey).
            useChangeLogStore.getState().addEntry({
              process_id: proc.id,
              action: 'created',
              description: `Proceso "${name}" creado`,
              author,
            })
          }
        })()
        return proc
      },

      bulkAddProcesses: async (procs) => {
        if (!procs.length) return { ok: 0, failed: 0 }
        // Garantiza dueño y empresa: sin user_id la RLS rechaza el INSERT y el
        // volcado subía "unos sí y otros no".
        const uid = currentUserId()
        const cid = currentCompanyId() ?? ''
        const rows = procs.map((p) => ({
          ...p,
          user_id: p.user_id || uid,
          company_id: p.company_id || cid,
        }))
        // Alta optimista de todo el lote.
        set((s) => ({ processes: [...s.processes, ...rows] }))
        const { createProcess } = await import('@/services/processes.service')
        const failed = new Set<string>()
        let ok = 0
        // Secuencial y en orden: los padres se confirman antes que sus hijos.
        for (const p of rows) {
          if (p.parent_process_id && failed.has(p.parent_process_id)) { failed.add(p.id); continue }
          const res = await dbWrite('process:createProcess', createProcess(p as never), { silent: true })
          if (res.ok) ok++
          else failed.add(p.id)
        }
        if (failed.size) {
          // Revierte solo lo que no se pudo guardar; conserva lo que sí.
          set((s) => ({ processes: s.processes.filter((p) => !failed.has(p.id)) }))
        }
        return { ok, failed: failed.size }
      },

      updateProcess: (id, updates) => {
        if (updates.bpmn_xml !== undefined) {
          const current = get().processes.find((p) => p.id === id)
          if (current && updates.bpmn_xml !== current.bpmn_xml) {
            const author = useAuthStore.getState().profile?.full_name || 'Usuario'
            useChangeLogStore.getState().addEntry({
              process_id: id,
              action: 'bpmn_updated',
              description: 'Flujograma BPMN actualizado',
              author,
            })
          }
        }
        const prev = get().processes
        set((s) => ({
          processes: s.processes.map((p) =>
            p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
          ),
        }))
        // Nota: updateProcess es de alta frecuencia (auto-save de characterization,
        // BPMN XML, etc.) — usamos silent para no tostar en cada tecla.
        void (async () => {
          const { updateProcess: updateInDB } = await import('@/services/processes.service')
          await dbWrite(
            'process:updateProcess',
            updateInDB(id, updates as never),
            {
              silent: true,
              rollback: () => set({ processes: prev }),
            }
          )
        })()
      },

      renameOrgReference: (field, oldName, newName) => {
        const clean = newName.trim()
        if (!oldName || !clean || oldName === clean) return
        const affected = get().processes.filter((p) => (p[field] as string | undefined) === oldName)
        if (!affected.length) return
        const prev = get().processes
        set((s) => ({
          processes: s.processes.map((p) =>
            (p[field] as string | undefined) === oldName
              ? { ...p, [field]: clean, updated_at: new Date().toISOString() }
              : p
          ),
        }))
        void (async () => {
          const cid = currentCompanyId()
          let q = supabase
            .from('processes')
            .update({ [field]: clean, updated_at: new Date().toISOString() } as never)
            .eq(field, oldName)
          if (cid) q = q.eq('company_id', cid)
          await dbWrite('process:renameOrgReference', q, {
            silent: true,
            rollback: () => set({ processes: prev }),
          })
        })()
      },

      clearOrgReference: (field, names) => {
        const targets = new Set(names.map((n) => n?.trim()).filter(Boolean))
        if (!targets.size) return
        const affected = get().processes.filter((p) => targets.has((p[field] as string | undefined) ?? ''))
        if (!affected.length) return
        const prev = get().processes
        set((s) => ({
          processes: s.processes.map((p) =>
            targets.has((p[field] as string | undefined) ?? '')
              ? { ...p, [field]: null, updated_at: new Date().toISOString() }
              : p
          ),
        }))
        void (async () => {
          const cid = currentCompanyId()
          let q = supabase
            .from('processes')
            .update({ [field]: null, updated_at: new Date().toISOString() } as never)
            .in(field, [...targets])
          if (cid) q = q.eq('company_id', cid)
          await dbWrite('process:clearOrgReference', q, {
            silent: true,
            rollback: () => set({ processes: prev }),
          })
        })()
      },

      deleteProcess: (id, opts) => {
        // Cascade delete all descendants
        const allIds = new Set<string>([id])
        let frontier = [id]
        while (frontier.length > 0) {
          const children = get()
            .processes.filter((p) => p.parent_process_id && frontier.includes(p.parent_process_id))
            .map((p) => p.id)
          children.forEach((c) => allIds.add(c))
          frontier = children
        }
        const prev = get().processes
        set((s) => ({
          processes: s.processes.filter((p) => !allIds.has(p.id)),
        }))
        void (async () => {
          const { deleteProcess: deleteInDB } = await import('@/services/processes.service')
          await dbWrite(
            'process:deleteProcess',
            deleteInDB(id),
            {
              successMessage: opts?.silent ? undefined : 'Proceso eliminado.',
              silent: opts?.silent,
              errorMessage: 'No se pudo eliminar el proceso.',
              rollback: () => set({ processes: prev }),
            }
          )
        })()
      },

      reorderProcesses: (parentId, macroId, orderedIds) => {
        set((s) => ({
          processes: s.processes.map((p) => {
            const isSibling = parentId
              ? p.parent_process_id === parentId
              : p.macroprocess_id === macroId && !p.parent_process_id
            if (!isSibling) return p
            const idx = orderedIds.indexOf(p.id)
            return idx >= 0 ? { ...p, sort_order: idx } : p
          }),
        }))
        // Persistir nuevos sort_order en Supabase (fire-and-forget)
        import('@/lib/supabase').then(({ supabase }) => {
          orderedIds.forEach((procId, idx) => {
            supabase.from('processes').update({ sort_order: idx }).eq('id', procId).then(({ error }) => {
              if (error) console.warn('[processStore] Error reordenando proceso:', error.message)
            })
          })
        })
      },

      // --- Queries ---
      getProcessesByMacroprocess: (macroId) =>
        get()
          .processes.filter((p) => p.macroprocess_id === macroId && !p.parent_process_id)
          .sort((a, b) => a.sort_order - b.sort_order),

      getChildProcesses: (parentId) =>
        get()
          .processes.filter((p) => p.parent_process_id === parentId)
          .sort((a, b) => a.sort_order - b.sort_order),

      getProcessesByLevel: (_level) => {
        // Level 1 = macroprocesses (separate array), level 2 = top-level processes, level 3 = children of level 2
        // This is a simplified implementation
        return get().processes
      },

      clearCompanyData: (companyId) => {
        const removedIds = get().processes
          .filter((p) => p.company_id === companyId)
          .map((p) => p.id)
        set((s) => ({
          macroprocesses: s.macroprocesses.filter((m) => m.company_id !== companyId),
          processes: s.processes.filter((p) => p.company_id !== companyId),
          levelDefinitions: [],
        }))
        return removedIds
      },

      // --- DB sync ---
      loadFromDB: async (companyId) => {
        try {
          const [macroResult, procResult] = await Promise.all([
            supabase.from('macroprocesses')
              .select('*').eq('company_id', companyId).order('sort_order'),
            supabase.from('processes')
              .select('*').eq('company_id', companyId).order('sort_order'),
          ])
          if (macroResult.data != null && macroResult.data.length > 0) set({ macroprocesses: macroResult.data as unknown as Macroprocess[] })
          if (procResult.data != null && procResult.data.length > 0) set({ processes: procResult.data as unknown as Process[] })
        } catch { /* silent — localStorage remains source of truth on error */ }
      },

      syncToDB: async (companyId) => {
        const { macroprocesses, processes } = get()
        try {
          if (macroprocesses.length > 0) {
            const macroRows = macroprocesses.map((m) =>
              MacroprocessSchema.parse({ ...m, company_id: companyId })
            )
            await supabase.from('macroprocesses').upsert(macroRows as unknown as import('@/types/database').Database['public']['Tables']['macroprocesses']['Insert'][])
          }
          if (processes.length > 0) {
            const processRows = processes.map((p) =>
              ProcessSchema.parse({ ...p, company_id: companyId })
            )
            await supabase.from('processes').upsert(processRows as unknown as import('@/types/database').Database['public']['Tables']['processes']['Insert'][])
          }
        } catch (err) {
          console.warn('[processStore] syncToDB error:', err)
        }
      },
    }),
    {
      name: 'lean-process-processes',
      version: 2,
      // Solo persistir datos esenciales; selectedProcess es efímero
      partialize: (state) => ({
        macroprocesses: state.macroprocesses,
        processes: state.processes,
        levelDefinitions: state.levelDefinitions,
      }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
