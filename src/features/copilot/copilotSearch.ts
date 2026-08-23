// Búsqueda híbrida para el copiloto: palabras clave + sinónimos del dominio +
// tolerancia a errores (fuzzy). Sirve tanto para elegir procesos relevantes
// como para reencontrar un nombre citado con typos.

import { norm } from '@/features/inventory/inventoryUtils'

export const STOPWORDS = new Set([
  'como', 'cómo', 'para', 'que', 'qué', 'cual', 'cuál', 'cuales', 'cuáles', 'donde', 'dónde',
  'quien', 'quién', 'los', 'las', 'del', 'una', 'uno', 'con', 'por', 'sin', 'sobre', 'entre',
  'este', 'esta', 'estos', 'estas', 'tiene', 'tienen', 'hace', 'hacen', 'proceso', 'procesos',
  'the', 'and', 'mis', 'sus', 'tengo', 'dame', 'muestra', 'quiero', 'necesito',
])

export function keywords(q: string): string[] {
  return [...new Set(norm(q).split(/\s+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w)))]
}

// Grupos de sinónimos del dominio (todo en minúsculas sin acentos, como `norm`).
const SYNONYMS: string[][] = [
  ['contratar', 'contratacion', 'contrataciones', 'reclutamiento', 'reclutar', 'seleccion', 'personal', 'talento', 'empleado', 'colaborador', 'nomina', 'vacante', 'candidato', 'recursos', 'humanos'],
  ['cliente', 'clientes', 'comercial', 'venta', 'ventas', 'crm'],
  ['compra', 'compras', 'adquisicion', 'adquisiciones', 'proveedor', 'proveedores', 'abastecimiento'],
  ['riesgo', 'riesgos', 'control', 'controles'],
  ['indicador', 'indicadores', 'kpi', 'kpis', 'metrica', 'metricas', 'medicion'],
  ['procedimiento', 'procedimientos', 'instructivo', 'manual', 'pasos'],
  ['flujograma', 'flujogramas', 'diagrama', 'bpmn', 'flujo'],
  ['mejora', 'mejoras', 'oportunidad', 'oportunidades'],
  ['valor', 'desperdicio', 'eficiencia'],
  ['auditoria', 'auditorias', 'cumplimiento'],
  ['factura', 'facturacion', 'cobro', 'pago', 'tesoreria', 'finanzas', 'contabilidad'],
  ['inventario', 'stock', 'almacen', 'bodega'],
  ['marketing', 'webinar', 'webinars', 'campaña', 'lead', 'leads', 'prospecto'],
]

const GROUPS_BY_TERM = (() => {
  const m = new Map<string, number[]>()
  SYNONYMS.forEach((g, i) => g.forEach((t) => { const a = m.get(t) ?? []; a.push(i); m.set(t, a) }))
  return m
})()

// Distancia de edición acotada (barata): true si a y b difieren en ≤ max.
export function fuzzyEq(a: string, b: string): boolean {
  if (a === b) return true
  const max = a.length <= 5 || b.length <= 5 ? 1 : 2
  if (Math.abs(a.length - b.length) > max) return false
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    let rowMin = dp[0]
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
      if (dp[j] < rowMin) rowMin = dp[j]
    }
    if (rowMin > max) return false // early exit: fila entera excede el umbral
  }
  return dp[b.length] <= max
}

export interface WeightedTerm { term: string; w: number }

// Expande las palabras clave con sus sinónimos (peso menor para lo añadido).
export function expandSynonyms(kws: string[]): WeightedTerm[] {
  const out = new Map<string, number>()
  for (const kw of kws) {
    out.set(kw, Math.max(out.get(kw) ?? 0, 1))
    for (const [term, groups] of GROUPS_BY_TERM) {
      if (term === kw || fuzzyEq(term, kw)) {
        for (const gi of groups) for (const t of SYNONYMS[gi]) out.set(t, Math.max(out.get(t) ?? 0, 0.5))
      }
    }
  }
  return [...out].map(([term, w]) => ({ term, w }))
}

// Puntúa un texto (ya normalizado) contra términos ponderados: substring exacto
// vale doble; coincidencia fuzzy por token vale el peso simple.
export function scoreText(normText: string, terms: WeightedTerm[]): number {
  const tokens = normText.split(/\s+/)
  let s = 0
  for (const { term, w } of terms) {
    if (normText.includes(term)) s += w * 2
    else if (tokens.some((tok) => fuzzyEq(tok, term))) s += w
  }
  return s
}

// Mejor candidato (por nombre) para un texto con posibles typos/sinónimos, o
// null si ninguno supera el umbral (evita emparejar cualquier cosa).
export function bestMatch(name: string, candidates: string[]): string | null {
  const kws = keywords(name)
  const terms: WeightedTerm[] = (kws.length ? kws : norm(name).split(/\s+/).filter(Boolean)).map((t) => ({ term: t, w: 1 }))
  if (!terms.length) return null
  let best: string | null = null
  let bestScore = 0
  for (const c of candidates) {
    const sc = scoreText(norm(c), terms)
    if (sc > bestScore) { bestScore = sc; best = c }
  }
  return bestScore >= 2 ? best : null
}
