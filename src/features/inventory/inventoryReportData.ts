import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import type { InvMacro } from './types'
import { allSubs, norm, type FlatSub } from './inventoryUtils'

// Enriquece cada subproceso del inventario con SU caracterización real y su
// SIPOC, cruzando por nombre (macro → proceso → subproceso) contra el mapa de
// procesos ya volcado. Lo que no está volcado queda con los campos vacíos.
// Todos los proveedores/entradas/salidas/clientes de un mismo proceso se
// concatenan en la MISMA fila (una columna por cada rol del SIPOC).

export interface RepFilters {
  tipo: string; macro: string; area: string; origen: string
  nivel: string; gerencia: string; critico: string; efectivo: string
}

export const EMPTY_FILTERS: RepFilters = { tipo: '', macro: '', area: '', origen: '', nivel: '', gerencia: '', critico: '', efectivo: '' }

export interface InvReportRow extends FlatSub {
  critico: boolean | null
  efectivo: boolean | null
  nivelEjecucion: string
  gerencia: string
  proveedores: string
  entradas: string
  salidas: string
  clientes: string
  matched: boolean
}

const uniqJoin = (xs: (string | undefined | null)[]): string => {
  const seen = new Set<string>()
  const out: string[] = []
  xs.forEach((x) => {
    const v = (x || '').trim()
    if (!v) return
    const k = norm(v)
    if (seen.has(k)) return
    seen.add(k)
    out.push(v)
  })
  return out.join(' · ')
}

/** Filas del reporte con caracterización + SIPOC ya cruzados. */
export function useInventoryReportRows(companyId: string, macros: InvMacro[]): InvReportRow[] {
  const processes = useProcessStore((s) => s.processes)
  const appMacros = useProcessStore((s) => s.macroprocesses)
  const sipocEntries = useCatalogStore((s) => s.sipocEntries)

  return useMemo(() => {
    const flat = allSubs(macros)
    const realMacros = appMacros.filter((m) => m.company_id === companyId)
    const procs = processes.filter((p) => p.company_id === companyId)
    const sipocByProc = new Map<string, typeof sipocEntries>()
    sipocEntries.forEach((e) => {
      if (!sipocByProc.has(e.process_id)) sipocByProc.set(e.process_id, [])
      sipocByProc.get(e.process_id)!.push(e)
    })

    return flat.map((s): InvReportRow => {
      const rm = realMacros.find((m) => norm(m.name) === norm(s.macro))
      const parent = rm && procs.find((p) => p.macroprocess_id === rm.id && !p.parent_process_id && norm(p.name) === norm(s.proceso))
      const sub = parent && procs.find((p) => p.parent_process_id === parent.id && norm(p.name) === norm(s.nombre))
      const match = sub || parent || null

      const entries = match ? (sipocByProc.get(match.id) ?? []) : []
      return {
        ...s,
        critico: match ? match.is_critical : null,
        efectivo: match ? match.involves_cash_movement : null,
        nivelEjecucion: match?.execution_level ?? '',
        gerencia: match?.management ?? '',
        proveedores: uniqJoin(entries.map((e) => e.supplier_name)),
        entradas: uniqJoin(entries.map((e) => e.input_description)),
        salidas: uniqJoin(entries.map((e) => e.output_description)),
        clientes: uniqJoin(entries.map((e) => e.customer_name)),
        matched: !!sub,
      }
    })
  }, [macros, processes, appMacros, sipocEntries, companyId])
}
