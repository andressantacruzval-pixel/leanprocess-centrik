import { useProcessStore } from '@/stores/processStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { generateId } from '@/utils/id'
import type { Process } from '@/types/process'
import { norm } from './inventoryUtils'

// Vuelca al MAPA DE PROCESOS real (tabla processes) los subprocesos ACEPTADOS del
// inventario: crea el proceso (nivel 2) bajo su macroproceso y el subproceso
// (nivel 3) bajo ese proceso. Idempotente por nombre. Área hoja → coordination,
// objetivo → description. Inserta EN LOTE, padres antes que hijos, para no violar
// la FK parent_process_id (esa carrera causaba "No se pudo guardar el proceso").

export interface VolcadoReport { procesos: number; subprocesos: number; failed: number; sinMacro: string[] }

function nuevoProceso(opts: { id: string; companyId: string; macroId: string; parentId: string | null; name: string; sortOrder: number; area?: string; objetivo?: string }): Process {
  const now = new Date().toISOString()
  return {
    id: opts.id,
    company_id: opts.companyId,
    macroprocess_id: opts.macroId,
    parent_process_id: opts.parentId,
    name: opts.name,
    coordination: opts.area || undefined,
    description: opts.objetivo || undefined,
    is_critical: false,
    has_contingency_plan: false,
    involves_cash_movement: false,
    has_tax_operations: false,
    affects_accounting: false,
    handles_personal_data: false,
    provided_by_third_party: false,
    sort_order: opts.sortOrder,
    created_at: now,
    updated_at: now,
  }
}

export async function volcarAceptadosAlMapa(companyId: string): Promise<VolcadoReport> {
  const inv = useInventoryStore.getState().getDoc(companyId)
  const ps = useProcessStore.getState()
  const existing = ps.processes
  const macrosApp = ps.macroprocesses.filter((m) => m.company_id === companyId)
  const rep: VolcadoReport = { procesos: 0, subprocesos: 0, failed: 0, sinMacro: [] }

  const batch: Process[] = []
  // Índice de nombres ya presentes/pendientes por (padre → set de nombres).
  const childName = (parentId: string, name: string) => `${parentId}::${norm(name)}`
  const existingChildren = new Set(existing.filter((p) => p.parent_process_id).map((p) => childName(p.parent_process_id!, p.name)))
  const pendingChildren = new Set<string>()

  inv.macros.forEach((invMacro) => {
    const procesosConAceptados = invMacro.procesos
      .map((p) => ({ nombre: p.nombre, subs: p.subprocesos.filter((s) => s.origen === 'confirmado') }))
      .filter((p) => p.subs.length)
    if (!procesosConAceptados.length) return

    const realMacro = macrosApp.find((m) => norm(m.name) === norm(invMacro.nombre))
    if (!realMacro) { rep.sinMacro.push(invMacro.nombre); return }

    let topOrder = existing.filter((p) => p.macroprocess_id === realMacro.id && !p.parent_process_id).length
      + batch.filter((p) => p.macroprocess_id === realMacro.id && !p.parent_process_id).length

    procesosConAceptados.forEach((proc) => {
      // Proceso padre: reutiliza el existente o crea uno nuevo en el lote.
      const existingProc = existing.find((p) => p.macroprocess_id === realMacro.id && !p.parent_process_id && norm(p.name) === norm(proc.nombre))
      const pendingProc = batch.find((p) => p.macroprocess_id === realMacro.id && !p.parent_process_id && norm(p.name) === norm(proc.nombre))
      let parentId: string
      if (existingProc) parentId = existingProc.id
      else if (pendingProc) parentId = pendingProc.id
      else {
        parentId = generateId()
        batch.push(nuevoProceso({ id: parentId, companyId, macroId: realMacro.id, parentId: null, name: proc.nombre, sortOrder: topOrder++ }))
        rep.procesos++
      }

      let subOrder = existing.filter((p) => p.parent_process_id === parentId).length + batch.filter((p) => p.parent_process_id === parentId).length
      proc.subs.forEach((sub) => {
        const key = childName(parentId, sub.nombre)
        if (existingChildren.has(key) || pendingChildren.has(key)) return
        pendingChildren.add(key)
        batch.push(nuevoProceso({ id: generateId(), companyId, macroId: realMacro.id, parentId, name: sub.nombre, sortOrder: subOrder++, area: sub.area, objetivo: sub.objetivo }))
        rep.subprocesos++
      })
    })
  })

  if (batch.length) {
    const r = await useProcessStore.getState().bulkAddProcesses(batch)
    rep.failed = r.failed
  }
  return rep
}

/** Cuenta cuántos subprocesos aceptados aún NO existen en el mapa. */
export function pendientesDeVolcar(companyId: string): number {
  const inv = useInventoryStore.getState().getDoc(companyId)
  const ps = useProcessStore.getState()
  const macrosApp = ps.macroprocesses.filter((m) => m.company_id === companyId)
  let n = 0
  inv.macros.forEach((invMacro) => {
    const realMacro = macrosApp.find((m) => norm(m.name) === norm(invMacro.nombre))
    if (!realMacro) return
    invMacro.procesos.forEach((proc) => {
      const realProc = ps.processes.find((p) => p.macroprocess_id === realMacro.id && !p.parent_process_id && norm(p.name) === norm(proc.nombre))
      proc.subprocesos.filter((s) => s.origen === 'confirmado').forEach((sub) => {
        const exists = realProc && ps.processes.some((p) => p.parent_process_id === realProc.id && norm(p.name) === norm(sub.nombre))
        if (!exists) n++
      })
    })
  })
  return n
}
