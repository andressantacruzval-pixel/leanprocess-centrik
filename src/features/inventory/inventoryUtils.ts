// Helpers puros del inventario (normalización, similitud, áreas hoja, detección
// de nombres verbales). Portados de la herramienta AI Process Manager.
import type { InvArea, InvMacro, InvSub } from './types'

const STOP = ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'para', 'a', 'al', 'por', 'con', 'un', 'una']

export const norm = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toks = (s: unknown): string[] => norm(s).split(' ').filter((w) => w && !STOP.includes(w))

/** Similitud Jaccard por tokens (0–1). */
export function sim(a: unknown, b: unknown): number {
  const A = new Set(toks(a)), B = new Set(toks(b))
  if (!A.size || !B.size) return 0
  let i = 0
  A.forEach((x) => { if (B.has(x)) i++ })
  return i / (A.size + B.size - i)
}

/** Índice del elemento con nombre igual (o muy parecido, ≥0.7). -1 si no hay. */
export function findBy<T>(arr: T[], name: string, key?: keyof T): number {
  const n = norm(name)
  const val = (x: T) => (key ? (x[key] as unknown) : x)
  const idx = arr.findIndex((x) => norm(val(x)) === n)
  if (idx >= 0) return idx
  let best = -1, bs = 0
  arr.forEach((x, i) => { const s = sim(val(x), name); if (s > bs) { bs = s; best = i } })
  return bs >= 0.7 ? best : -1
}

/** Áreas hoja: las que no son padre de ninguna otra. Reciben los subprocesos. */
export function leafAreas(areas: InvArea[], macros: InvMacro[]): string[] {
  if (areas.length) {
    const padres = new Set(areas.map((a) => norm(a.padre)).filter(Boolean))
    return areas.filter((a) => !padres.has(norm(a.nombre))).map((a) => a.nombre)
  }
  const s = new Set<string>()
  macros.forEach((m) => m.procesos.forEach((p) => (p.subprocesos || []).forEach((x) => {
    if ((x.area || '').trim()) s.add(x.area.trim())
  })))
  return [...s].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Cadena de padres de un área (raíz → inmediato). */
export function areaPath(areas: InvArea[], name: string): string[] {
  const i = findBy(areas, name, 'nombre'); if (i < 0) return []
  const out: string[] = []; let cur: InvArea | null = areas[i]; let guard = 0
  while (cur && cur.padre && guard++ < 8) {
    const padre: string = cur.padre
    out.unshift(padre)
    const j: number = findBy(areas, padre, 'nombre')
    cur = j >= 0 ? areas[j] : null
  }
  return out
}

export interface FlatSub extends InvSub { macro: string; tipo: string; proceso: string; mi: number; pi: number; si: number }

/** Todos los subprocesos aplanados con su macro/proceso e índices (mi/pi/si). */
export function allSubs(macros: InvMacro[]): FlatSub[] {
  const o: FlatSub[] = []
  macros.forEach((m, mi) => (m.procesos || []).forEach((p, pi) => (p.subprocesos || []).forEach((s, si) => {
    o.push({ ...s, macro: m.nombre, tipo: m.tipo, proceso: p.nombre, mi, pi, si })
  })))
  return o
}

const NO_VERBO = ['bienestar', 'hogar', 'lugar', 'ejemplar', 'particular', 'auxiliar', 'familiar', 'escolar', 'celular', 'militar', 'titular', 'poder', 'deber', 'placer', 'mujer', 'caracter', 'porvenir', 'ser', 'haber', 'estandar', 'dolar', 'solar', 'pilar', 'avatar', 'azucar', 'nectar', 'radar', 'collar']

/** Heurística: ¿el nombre empieza con verbo (debería ser nominal)? */
export function pareceVerbo(nombre: string): boolean {
  const w = norm(nombre).split(' ')[0]
  if (!w || w.length < 4) return false
  if (NO_VERBO.indexOf(w) >= 0) return false
  if (/(ando|endo)$/.test(w)) return true
  if (/(ar|er|ir)$/.test(w)) return true
  return false
}

export interface Counted { label: string; value: number }

/** Cuenta por campo, descendente; los vacíos van como "(sin asignar)". */
export function countBy(rows: FlatSub[], key: keyof FlatSub): Counted[] {
  const m = new Map<string, number>()
  rows.forEach((r) => {
    const k = String(r[key] || '').trim() || '(sin asignar)'
    m.set(k, (m.get(k) || 0) + 1)
  })
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
