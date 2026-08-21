// Métricas y hallazgos del inventario para el dashboard. Portado de la
// herramienta AI Process Manager.
import type { InvArea, InvMacro } from './types'
import { allSubs, countBy, leafAreas, norm, pareceVerbo } from './inventoryUtils'

export interface MacroStats { P: number; S: number; conSub: number; conArea: number; conObj: number; ded: number; pct: number }

export function stats(m: InvMacro): MacroStats {
  const P = (m.procesos || []).length
  const subs = (m.procesos || []).flatMap((p) => (p.subprocesos || []))
  const conSub = (m.procesos || []).filter((p) => (p.subprocesos || []).length).length
  const conArea = subs.filter((x) => (x.area || '').trim()).length
  const conObj = subs.filter((x) => (x.objetivo || '').trim().length >= 15).length
  const ded = subs.filter((x) => x.origen === 'deducido').length
  let pct = 0
  if (P > 0) {
    let req = 1, got = 1
    req++; got += conSub / P
    req++; got += subs.length ? conArea / subs.length : 0
    req++; got += subs.length ? conObj / subs.length : 0
    pct = Math.round(got / req * 100)
  }
  pct = Math.min(pct, 99)
  return { P, S: subs.length, conSub, conArea, conObj, ded, pct }
}

export interface GlobalStats { P: number; S: number; pct: number; done: number; vacios: number; ded: number; conObj: number; conArea: number; M: number; A: number }

export function globalStats(macros: InvMacro[], areas: InvArea[]): GlobalStats {
  let P = 0, S = 0, pct = 0, done = 0, vacios = 0, ded = 0, conObj = 0, conArea = 0
  macros.forEach((m) => {
    const s = stats(m); P += s.P; S += s.S; pct += s.pct; ded += s.ded; conObj += s.conObj; conArea += s.conArea
    if (s.pct >= 100) done++; if (!s.P) vacios++
  })
  return { P, S, pct: macros.length ? Math.round(pct / macros.length) : 0, done, vacios, ded, conObj, conArea, M: macros.length, A: leafAreas(areas, macros).length }
}

export type FindingLevel = 'crit' | 'ser' | 'warn' | 'ok'
export interface Finding { lvl: FindingLevel; t: string }

/** Cruces automáticos que solo aparecen con el inventario anclado al área. */
export function findings(macros: InvMacro[], areas: InvArea[]): Finding[] {
  const F: Finding[] = []
  const subs = allSubs(macros)
  const hojas = leafAreas(areas, macros)
  const porArea = countBy(subs, 'area')
  const conCarga = new Set(porArea.map((x) => x.label))
  const sinCarga = hojas.filter((a) => !conCarga.has(a))
  if (sinCarga.length) F.push({ lvl: 'crit', t: `${sinCarga.length} área(s) sin ningún subproceso asignado: ${sinCarga.join(', ')}. O falta levantarlas, o su trabajo lo ejecuta otra área.` })

  const sinArea = subs.filter((s) => !(s.area || '').trim()).length
  if (sinArea) F.push({ lvl: 'warn', t: `${sinArea} subproceso(s) sin área responsable. Sin área no hay quién responda por el resultado.` })

  const nom = new Map<string, typeof subs>()
  subs.forEach((s) => { const k = norm(s.nombre); if (!k) return; if (!nom.has(k)) nom.set(k, []); nom.get(k)!.push(s) })
  const dup = [...nom.values()].filter((v) => v.length > 1 && new Set(v.map((x) => x.area)).size > 1)
  if (dup.length) F.push({ lvl: 'ser', t: `${dup.length} subproceso(s) se ejecutan en más de un área: ${dup.slice(0, 3).map((v) => v[0].nombre + ' (' + [...new Set(v.map((x) => x.area))].join(' / ') + ')').join(' · ')}${dup.length > 3 ? '…' : ''}. Puede ser duplicidad real.` })

  let cruzan = 0
  macros.forEach((m) => m.procesos.forEach((p) => { const a = new Set((p.subprocesos || []).map((s) => s.area).filter(Boolean)); if (a.size > 1) cruzan++ }))
  if (cruzan) F.push({ lvl: 'ok', t: `${cruzan} proceso(s) cruzan dos o más áreas. Es lo esperado y lo valioso: ahí está el traspaso de mano y los cuellos de botella.` })

  if (porArea.length > 2) {
    const vals = porArea.map((x) => x.value).sort((a, b) => a - b)
    const med = vals[Math.floor(vals.length / 2)]
    const alta = porArea.filter((x) => x.value >= med * 1.8 && x.label !== '(sin asignar)')
    const baja = porArea.filter((x) => x.value <= 2 && x.label !== '(sin asignar)')
    if (alta.length) F.push({ lvl: 'warn', t: `Concentración de carga: ${alta.map((x) => x.label + ' (' + x.value + ')').join(', ')} muy por encima de la mediana (${med}). Revisa capacidad.` })
    if (baja.length) F.push({ lvl: 'warn', t: `Áreas con muy poco trabajo levantado: ${baja.map((x) => x.label + ' (' + x.value + ')').join(', ')}. O falta levantar, o son candidatas a fusión.` })
  }

  if (subs.length > 150) F.push({ lvl: 'ser', t: `El inventario tiene ${subs.length} subprocesos, por encima del rango esperado (80–150). Suele significar que se inventariaron actividades: agrupa.` })

  const nv = subs.filter((x) => pareceVerbo(x.nombre)).length + macros.flatMap((m) => m.procesos).filter((p) => pareceVerbo(p.nombre)).length
  if (nv) F.push({ lvl: 'ser', t: `${nv} nombre(s) están escritos como verbo y deberían ser nominales. Ej.: «entrevistar candidatos» → «Entrevistas y evaluaciones».` })

  const gordos = macros.flatMap((m) => m.procesos).filter((p) => (p.subprocesos || []).length > 6)
  if (gordos.length) F.push({ lvl: 'warn', t: `${gordos.length} proceso(s) con más de 6 subprocesos. Señal de actividades en vez de etapas: agrúpalas.` })

  const vac = macros.filter((m) => !m.procesos.length)
  if (vac.length) F.push({ lvl: 'warn', t: `${vac.length} macroproceso(s) sin levantar: ${vac.map((m) => m.nombre).join(', ')}.` })

  const ded = subs.filter((s) => s.origen === 'deducido').length
  if (ded) F.push({ lvl: 'warn', t: `${ded} subproceso(s) siguen marcados como deducidos. Valídalos con el cliente antes de cerrar.` })

  const sinObj = subs.filter((s) => (s.objetivo || '').trim().length < 15).length
  if (sinObj) F.push({ lvl: 'warn', t: `${sinObj} subproceso(s) sin objetivo redactado.` })

  if (!F.length) F.push({ lvl: 'ok', t: 'Sin hallazgos abiertos. Todas las áreas tienen trabajo, no hay duplicidades evidentes y todo está confirmado y con objetivo.' })
  return F
}
