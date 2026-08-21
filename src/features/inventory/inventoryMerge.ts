// Fusión de la respuesta JSON de la IA con el inventario existente. Nunca
// reemplaza: completa y marca. Portado de la herramienta AI Process Manager.
import type { InvArea, InvMacro, InvProceso, InvSub, InvTipo } from './types'
import { findBy } from './inventoryUtils'

function normSub(s: unknown): InvSub {
  if (typeof s === 'string') return { nombre: s.trim(), area: '', objetivo: '', origen: 'deducido' }
  const o = s as Record<string, unknown>
  const origen = String(o.origen || '').toLowerCase()
  return {
    nombre: String(o.nombre || o.subproceso || o.name || '').trim(),
    area: String(o.area || o['área'] || o.unidad || o.dueno || '').trim(),
    objetivo: String(o.objetivo || o.proposito || o['propósito'] || '').trim(),
    origen: origen === 'confirmado' ? 'confirmado' : 'deducido',
  }
}

function normProc(p: unknown): InvProceso {
  if (typeof p === 'string') return { nombre: p.trim(), subprocesos: [] }
  const o = p as Record<string, unknown>
  let subs = (o.subprocesos || o.subproceso || o.actividades || o.subProcesos || []) as unknown
  if (!Array.isArray(subs)) subs = []
  return {
    nombre: String(o.nombre || o.proceso || o.name || '').trim(),
    subprocesos: (subs as unknown[]).map(normSub).filter((s) => s.nombre),
  }
}

interface ParsedBlock { nombre: string; procesos: InvProceso[] }
export interface ParsedChunk { lote: ParsedBlock[]; areas: InvArea[] }

/** Extrae uno o varios bloques JSON (con o sin ```fences```) del texto de la IA. */
export function parseChunk(txt: string): ParsedChunk {
  const t = String(txt || '').trim()
  if (!t) throw new Error('Pega el JSON que te dio la IA.')
  const blocks: string[] = []
  const fences = t.match(/```(?:json)?\s*([\s\S]*?)```/gi)
  if (fences && fences.length) fences.forEach((b) => blocks.push(b.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()))
  else blocks.push(t)

  const lote: ParsedBlock[] = []
  const areas: InvArea[] = []
  blocks.forEach((bt) => {
    let o: unknown = null
    try { o = JSON.parse(bt) } catch {
      const mm = bt.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
      if (mm) { try { o = JSON.parse(mm[0]) } catch { /* ignore */ } }
    }
    if (!o || typeof o !== 'object') return
    const obj = o as Record<string, unknown>
    const ar = (obj.areas || obj.estructura || obj.organigrama) as unknown
    if (Array.isArray(ar)) ar.forEach((a) => {
      if (typeof a === 'string') areas.push({ nombre: a.trim(), padre: '' })
      else { const ao = a as Record<string, unknown>; areas.push({ nombre: String(ao.nombre || ao.area || '').trim(), padre: String(ao.padre || ao.depende || '').trim() }) }
    })
    let items: unknown[] = []
    if (Array.isArray(o)) items = o
    else if (Array.isArray(obj.macroprocesos)) items = obj.macroprocesos as unknown[]
    else if (obj.macroproceso || obj.nombre) items = [o]
    items.forEach((x) => {
      const xo = x as Record<string, unknown>
      const nombre = String(xo.macroproceso || xo.nombre || '').trim()
      const procesos = (Array.isArray(xo.procesos) ? (xo.procesos as unknown[]) : []).map(normProc).filter((p) => p.nombre)
      if (nombre) lote.push({ nombre, procesos })
    })
  })
  if (!lote.length && !areas.length) throw new Error('No encontré un JSON con la estructura esperada. Copia el bloque completo, desde la primera llave { hasta la última }.')
  return { lote, areas: areas.filter((a) => a.nombre) }
}

export interface MergeReport { mNew: number; pNew: number; pUpd: number; sNew: number; sUpd: number; aNew: number; nombres: string[] }

/** Fusiona (inmutable) el lote parseado sobre {macros, areas}. Devuelve copias nuevas. */
export function mergeChunk(
  macrosIn: InvMacro[],
  areasIn: InvArea[],
  parsed: ParsedChunk,
): { macros: InvMacro[]; areas: InvArea[]; report: MergeReport } {
  const macros: InvMacro[] = macrosIn.map((m) => ({ ...m, procesos: m.procesos.map((p) => ({ ...p, subprocesos: p.subprocesos.map((s) => ({ ...s })) })) }))
  const areas: InvArea[] = areasIn.map((a) => ({ ...a }))
  const R: MergeReport = { mNew: 0, pNew: 0, pUpd: 0, sNew: 0, sUpd: 0, aNew: 0, nombres: [] }

  parsed.areas.forEach((a) => {
    const k = findBy(areas, a.nombre, 'nombre')
    if (k < 0) { areas.push({ nombre: a.nombre, padre: a.padre || '' }); R.aNew++ }
    else if (a.padre && !areas[k].padre) areas[k].padre = a.padre
  })

  parsed.lote.forEach((blk) => {
    let mi = findBy(macros, blk.nombre, 'nombre')
    if (mi < 0) { macros.push({ nombre: blk.nombre, tipo: 'Apoyo' as InvTipo, procesos: [] }); mi = macros.length - 1; R.mNew++ }
    const M = macros[mi]
    if (R.nombres.indexOf(M.nombre) < 0) R.nombres.push(M.nombre)
    blk.procesos.forEach((np) => {
      const pi = findBy(M.procesos, np.nombre, 'nombre')
      let PR: InvProceso
      if (pi < 0) { PR = { nombre: np.nombre, subprocesos: [] }; M.procesos.push(PR); R.pNew++ }
      else { PR = M.procesos[pi]; R.pUpd++ }
      np.subprocesos.forEach((ns) => {
        const si = findBy(PR.subprocesos, ns.nombre, 'nombre')
        if (si < 0) { PR.subprocesos.push(ns); R.sNew++ }
        else {
          const S = PR.subprocesos[si]; R.sUpd++
          if (ns.area && !S.area) S.area = ns.area
          if (ns.objetivo && !S.objetivo) S.objetivo = ns.objetivo
          if (ns.origen === 'confirmado') S.origen = 'confirmado'
        }
      })
    })
  })
  return { macros, areas, report: R }
}
