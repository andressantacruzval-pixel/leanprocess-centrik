import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { InvArea, InvDoc, InvMacro, InvOrigen, InvProceso, InvSub, InvMetodo, InvProyecto } from '@/features/inventory/types'
import { parseChunk, mergeChunk, type MergeReport } from '@/features/inventory/inventoryMerge'

// Inventario de procesos por empresa (documento único). Persistido en el
// navegador y exportable/importable como .json (compatible con la herramienta
// externa AI Process Manager). El mapa Nivel 0 y las áreas se leen en vivo de la
// app; aquí vive solo el resultado del levantamiento (procesos y subprocesos).

const emptyProyecto = (): InvProyecto => ({ consultor: '', cliente: '', alcance: '', sector: '', fecha: '', ver: '1.0', metodo: 'incremental' })
const emptyDoc = (): InvDoc => ({ proyecto: emptyProyecto(), areas: [], macros: [] })

interface InventoryState {
  byCompany: Record<string, InvDoc>
  getDoc: (companyId: string) => InvDoc
  /** Siembra macros (mapa Nivel 0) y áreas desde la app sin pisar lo levantado. */
  seed: (companyId: string, macros: InvMacro[], areas: InvArea[]) => void
  setProyecto: (companyId: string, patch: Partial<InvProyecto>) => void
  setMetodo: (companyId: string, metodo: InvMetodo) => void
  /** Fusiona el JSON que devolvió la IA. Devuelve el reporte o un error. */
  mergeText: (companyId: string, text: string) => { ok: true; report: MergeReport } | { ok: false; error: string }
  replaceDoc: (companyId: string, doc: InvDoc) => void
  reset: (companyId: string) => void
  /** Edición en vivo (por índices mi=macro, pi=proceso, si=subproceso). */
  editSub: (companyId: string, mi: number, pi: number, si: number, patch: Partial<InvSub>) => void
  removeSub: (companyId: string, mi: number, pi: number, si: number) => void
  addSub: (companyId: string, mi: number, pi: number, sub: InvSub) => void
  editProceso: (companyId: string, mi: number, pi: number, nombre: string) => void
  removeProceso: (companyId: string, mi: number, pi: number) => void
  addProceso: (companyId: string, mi: number, nombre: string) => void
  /** Marca todos los subprocesos de un macro como aceptados (origen confirmado). */
  acceptMacro: (companyId: string, mi: number) => void
}

/** Aplica una transformación inmutable a los macros de una empresa. */
function mutMacros(
  byCompany: Record<string, InvDoc>,
  companyId: string,
  fn: (macros: InvMacro[]) => InvMacro[],
): { byCompany: Record<string, InvDoc> } {
  const prev = byCompany[companyId] ?? emptyDoc()
  const macros = prev.macros.map((m) => ({ ...m, procesos: m.procesos.map((p) => ({ ...p, subprocesos: p.subprocesos.map((x) => ({ ...x })) })) }))
  return { byCompany: { ...byCompany, [companyId]: { ...prev, macros: fn(macros) } } }
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      byCompany: {},

      getDoc: (companyId) => get().byCompany[companyId] ?? emptyDoc(),

      seed: (companyId, macros, areas) => set((s) => {
        const prev = s.byCompany[companyId] ?? emptyDoc()
        // Conserva los procesos levantados de cada macro que siga en el mapa;
        // añade los macros nuevos vacíos y respeta el orden del mapa.
        const prevByName = new Map(prev.macros.map((m) => [m.nombre.toLowerCase().trim(), m]))
        const nextMacros: InvMacro[] = macros.map((m) => {
          const old = prevByName.get(m.nombre.toLowerCase().trim())
          return old ? { ...m, procesos: old.procesos } : m
        })
        // Áreas: las de la app son la fuente; conserva las extra que la IA haya traído.
        const appNames = new Set(areas.map((a) => a.nombre.toLowerCase().trim()))
        const extra = prev.areas.filter((a) => !appNames.has(a.nombre.toLowerCase().trim()))
        return { byCompany: { ...s.byCompany, [companyId]: { ...prev, macros: nextMacros, areas: [...areas, ...extra] } } }
      }),

      setProyecto: (companyId, patch) => set((s) => {
        const prev = s.byCompany[companyId] ?? emptyDoc()
        return { byCompany: { ...s.byCompany, [companyId]: { ...prev, proyecto: { ...prev.proyecto, ...patch } } } }
      }),

      setMetodo: (companyId, metodo) => set((s) => {
        const prev = s.byCompany[companyId] ?? emptyDoc()
        return { byCompany: { ...s.byCompany, [companyId]: { ...prev, proyecto: { ...prev.proyecto, metodo } } } }
      }),

      mergeText: (companyId, text) => {
        const prev = get().byCompany[companyId] ?? emptyDoc()
        try {
          const parsed = parseChunk(text)
          const { macros, areas, report } = mergeChunk(prev.macros, prev.areas, parsed)
          set((s) => ({ byCompany: { ...s.byCompany, [companyId]: { ...prev, macros, areas } } }))
          return { ok: true, report }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'No pude leer el JSON.' }
        }
      },

      replaceDoc: (companyId, doc) => set((s) => ({ byCompany: { ...s.byCompany, [companyId]: doc } })),

      reset: (companyId) => set((s) => {
        const prev = s.byCompany[companyId] ?? emptyDoc()
        // Vacía lo levantado pero conserva el mapa base y las áreas y la ficha.
        return { byCompany: { ...s.byCompany, [companyId]: { ...prev, macros: prev.macros.map((m) => ({ ...m, procesos: [] })) } } }
      }),

      editSub: (companyId, mi, pi, si, patch) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        const sub = macros[mi]?.procesos[pi]?.subprocesos[si]
        if (sub) Object.assign(sub, patch)
        return macros
      })),

      removeSub: (companyId, mi, pi, si) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        const proc = macros[mi]?.procesos[pi]
        if (proc) proc.subprocesos.splice(si, 1)
        return macros
      })),

      addSub: (companyId, mi, pi, sub) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        const proc = macros[mi]?.procesos[pi]
        if (proc) proc.subprocesos.push(sub)
        return macros
      })),

      editProceso: (companyId, mi, pi, nombre) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        const proc = macros[mi]?.procesos[pi]
        if (proc) proc.nombre = nombre
        return macros
      })),

      removeProceso: (companyId, mi, pi) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        if (macros[mi]) macros[mi].procesos.splice(pi, 1)
        return macros
      })),

      addProceso: (companyId, mi, nombre) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        const proc: InvProceso = { nombre, subprocesos: [] }
        if (macros[mi]) macros[mi].procesos.push(proc)
        return macros
      })),

      acceptMacro: (companyId, mi) => set((s) => mutMacros(s.byCompany, companyId, (macros) => {
        macros[mi]?.procesos.forEach((p) => p.subprocesos.forEach((x) => { x.origen = 'confirmado' as InvOrigen }))
        return macros
      })),
    }),
    {
      name: 'lean-process-inventory',
      version: 1,
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)

/** Empresa activa (para componentes que no quieren pasar el id a mano). */
export function activeCompanyId(): string {
  return useWorkspaceStore.getState().activeCompanyId ?? ''
}
