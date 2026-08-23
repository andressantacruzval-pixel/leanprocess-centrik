// Capa de consulta estructurada: el modelo cierra su respuesta con un bloque
// ```json {"widget":{...}}``` que especifica el visual a mostrar. Parsear un
// bloque JSON con cierre es MUCHO más robusto que los marcadores inline (que se
// filtraban como texto y caían a agrupaciones por defecto). El sistema ejecuta
// el spec de forma DETERMINISTA (números, agrupación, inherente/residual, empresa
// o proceso), así el widget siempre corresponde a lo pedido.

import type { CopilotWidget } from '@/stores/copilotStore'
import { type ScopedData, findProcessByName } from './copilotData'

export interface WidgetSpec {
  kind?: string // chart | heatmap | risks | process | none
  entity?: string
  groupBy?: string
  chartType?: string
  category?: string
  control?: string
  basis?: string // inherent | residual
  level?: string
  process?: string
  title?: string
}

const JSON_BLOCK = /```json\s*([\s\S]*?)```/gi

// Localiza el objeto JSON balanceado que contiene "widget" (por si el modelo lo
// emite SIN las comillas de código). Devuelve el fragmento crudo y su posición.
function findBareWidgetObject(s: string): { raw: string; index: number } | null {
  const kw = s.lastIndexOf('"widget"')
  if (kw === -1) return null
  const start = s.lastIndexOf('{', kw)
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') { depth--; if (depth === 0) return { raw: s.slice(start, i + 1), index: start } }
  }
  return null // objeto aún incompleto (streaming)
}

function parseSpec(json: string): WidgetSpec | null {
  try {
    const parsed = JSON.parse(json) as { widget?: WidgetSpec } | WidgetSpec
    return (parsed as { widget?: WidgetSpec }).widget ?? (parsed as WidgetSpec)
  } catch { return null }
}

/** Extrae el spec de widget (bloque ```json``` o objeto {"widget"...} suelto) y lo quita del texto. */
export function extractPlan(buffer: string): { text: string; spec: WidgetSpec | null } {
  const matches = [...buffer.matchAll(JSON_BLOCK)]
  if (matches.length) {
    const last = matches[matches.length - 1]
    const idx = last.index ?? 0
    const text = (buffer.slice(0, idx) + buffer.slice(idx + last[0].length)).trim()
    return { text, spec: parseSpec(last[1]) }
  }
  const bare = findBareWidgetObject(buffer)
  if (bare) {
    const text = (buffer.slice(0, bare.index) + buffer.slice(bare.index + bare.raw.length)).trim()
    return { text, spec: parseSpec(bare.raw) }
  }
  return { text: buffer.trim(), spec: null }
}

const CHART_ENTITIES = new Set(['risks', 'processes', 'indicators', 'value', 'improvements'])

/** Convierte el spec del modelo en un widget concreto, validando y saneando. */
export function specToWidget(spec: WidgetSpec | null, data: ScopedData): CopilotWidget | null {
  if (!spec || !spec.kind || spec.kind === 'none') return null
  const p = (k?: string) => (k && k.trim() ? k.trim() : undefined)
  const resolveProc = (name?: string) => (name ? findProcessByName(data, name)?.name : undefined)

  switch (spec.kind) {
    case 'heatmap': {
      const params: Record<string, string> = {}
      const proc = resolveProc(spec.process)
      if (proc) params.process = proc
      if (p(spec.category)) params.category = spec.category!
      if (spec.basis === 'residual') params.basis = 'residual'
      params.title = spec.title || (proc ? `Mapa de calor · ${proc}` : `Mapa de calor de riesgos${spec.basis === 'residual' ? ' (residual)' : ''}`)
      return { name: 'HEATMAP', params }
    }
    case 'chart': {
      const entity = CHART_ENTITIES.has(spec.entity ?? '') ? spec.entity! : 'risks'
      const params: Record<string, string> = { entity }
      if (p(spec.groupBy)) params.groupBy = spec.groupBy!
      params.chartType = spec.chartType === 'pie' ? 'pie' : 'bar'
      if (p(spec.category)) params.category = spec.category!
      if (p(spec.control)) params.control = spec.control!
      if (spec.basis === 'residual') params.basis = 'residual'
      if (p(spec.title)) params.title = spec.title!
      return { name: 'CHART', params }
    }
    case 'risks': {
      const params: Record<string, string> = {}
      const proc = resolveProc(spec.process)
      if (proc) params.process = proc
      if (p(spec.control)) params.control = spec.control!
      if (p(spec.level)) params.level = spec.level!
      if (p(spec.category)) params.category = spec.category!
      return { name: 'RISKS', params }
    }
    case 'process': {
      const proc = resolveProc(spec.process)
      return proc ? { name: 'PROCESS', params: { name: proc } } : null
    }
    default:
      return null
  }
}
