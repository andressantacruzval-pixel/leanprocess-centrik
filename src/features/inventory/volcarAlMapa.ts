import { useProcessStore } from '@/stores/processStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { norm } from './inventoryUtils'

// Vuelca al MAPA DE PROCESOS real (tabla processes) los subprocesos ACEPTADOS del
// inventario: crea el proceso (nivel 2) bajo su macroproceso y el subproceso
// (nivel 3) bajo ese proceso. Idempotente: no duplica lo que ya existe (match por
// nombre). El área hoja va a `coordination` y el objetivo a `description`.

export interface VolcadoReport { procesos: number; subprocesos: number; sinMacro: string[] }

export function volcarAceptadosAlMapa(companyId: string): VolcadoReport {
  const inv = useInventoryStore.getState().getDoc(companyId)
  const ps = useProcessStore.getState()
  const rep: VolcadoReport = { procesos: 0, subprocesos: 0, sinMacro: [] }

  const macrosApp = ps.macroprocesses.filter((m) => m.company_id === companyId)

  inv.macros.forEach((invMacro) => {
    // Solo procesos con al menos un subproceso aceptado.
    const procesosConAceptados = invMacro.procesos
      .map((p) => ({ nombre: p.nombre, subs: p.subprocesos.filter((s) => s.origen === 'confirmado') }))
      .filter((p) => p.subs.length)
    if (!procesosConAceptados.length) return

    const realMacro = macrosApp.find((m) => norm(m.name) === norm(invMacro.nombre))
    if (!realMacro) { rep.sinMacro.push(invMacro.nombre); return }

    procesosConAceptados.forEach((proc) => {
      // Buscar/crear el proceso (nivel 2) bajo el macroproceso.
      let realProc = useProcessStore.getState().processes.find(
        (p) => p.macroprocess_id === realMacro.id && !p.parent_process_id && norm(p.name) === norm(proc.nombre)
      )
      if (!realProc) { realProc = ps.addProcess(proc.nombre, realMacro.id, null); rep.procesos++ }

      // Buscar/crear cada subproceso (nivel 3) bajo el proceso.
      proc.subs.forEach((sub) => {
        const exists = useProcessStore.getState().processes.find(
          (p) => p.parent_process_id === realProc!.id && norm(p.name) === norm(sub.nombre)
        )
        if (exists) return
        const nuevo = ps.addProcess(sub.nombre, realMacro.id, realProc!.id)
        const updates: Record<string, string> = {}
        if (sub.area) updates.coordination = sub.area
        if (sub.objetivo) updates.description = sub.objetivo
        if (Object.keys(updates).length) ps.updateProcess(nuevo.id, updates)
        rep.subprocesos++
      })
    })
  })

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
