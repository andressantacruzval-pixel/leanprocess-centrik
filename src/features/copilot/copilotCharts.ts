// Detección DETERMINISTA de gráficos y mapas de calor desde la pregunta del
// usuario. Antes dependíamos de que el modelo escribiera un marcador <<CHART>>
// perfecto; cuando fallaba, se filtraba texto y el gráfico caía a la agrupación
// por defecto. Ahora el sistema entiende la intención y arma el widget exacto.

import type { CopilotWidget } from '@/stores/copilotStore'
import type { ScopedData } from './copilotData'
import { norm } from '@/features/inventory/inventoryUtils'

const CHART_WORDS = /grafic|pastel|torta|circular|distribu|diagrama|barras?|\bchart\b/
const HEATMAP_WORDS = /mapa de calor|matriz de riesgo|heatmap|heat map/
const COMPANY_WORDS = /toda la empresa|de la empresa|empresa|general|todos|global/

type Entity = 'risks' | 'processes' | 'indicators' | 'value' | 'improvements' | 'assets' | 'applications' | 'cargos'

function detectEntity(q: string): Entity {
  if (/riesg/.test(q)) return 'risks'
  if (/indicador|kpi|metric/.test(q)) return 'indicators'
  if (/aplicaci|software|\bapp\b|aplicativo|herramienta tecnol/.test(q)) return 'applications'
  if (/activo|información sensible|informacion sensible|dato personal|datos personales/.test(q)) return 'assets'
  if (/\bcargo\b|cargos|puesto|\brol\b|\broles\b|perfil de/.test(q)) return 'cargos'
  if (/valor|desperdicio|\bnva\b|\bva\b/.test(q)) return 'value'
  if (/mejora|oportunidad/.test(q)) return 'improvements'
  if (/proceso|inventario|macro/.test(q)) return 'processes'
  return 'risks'
}

function detectCategory(q: string): string | undefined {
  if (/operacion|operativ/.test(q)) return 'Operacional'
  if (/cumplimiento/.test(q)) return 'Cumplimiento'
  if (/seguridad|informaci/.test(q)) return 'Seguridad Info'
  if (/f[ií]sic/.test(q)) return 'Fisico'
  return undefined
}

function detectGroupBy(q: string, entity: Entity): string {
  // Agrupaciones EXPLÍCITAS (no confundir con filtros).
  if (/por nivel|nivel de riesgo|niveles/.test(q)) return 'level'
  if (/por categor|categor[ií]a|tipo de riesgo/.test(q)) return 'category'
  if (/ejecutor/.test(q)) return 'executor'
  if (/macro/.test(q)) return 'macro'
  if (/[aá]rea|gerencia|departament/.test(q)) return 'area'
  if (/estado/.test(q)) return 'status'
  if (/\btipo\b/.test(q) && entity === 'improvements') return 'type'
  if (/prioridad/.test(q)) return 'priority'
  if (/con meta|sin meta|\bmeta\b/.test(q)) return 'meta'
  if (/frecuencia/.test(q)) return 'frequency'
  // Cortes propios de activos / aplicaciones.
  if (/criticidad/.test(q)) return 'criticality'
  if (/tipo de activo/.test(q)) return 'asset_type'
  if (/confidencial/.test(q)) return 'confidentiality'
  if (/dato personal|datos personales|personales/.test(q)) return 'personal_data'
  if (/despliegue|nube|cloud|on.?premise|on.?prem/.test(q)) return 'deployment'
  if (/propiedad|propia|terceros/.test(q)) return 'ownership'
  if (/riesgo tecnol/.test(q) || (entity === 'applications' && /riesgo/.test(q))) return 'risk'
  if (/\bapi\b/.test(q)) return 'api'
  if (/por proceso/.test(q)) return 'process'
  // Por defecto, la agrupación más útil de cada entidad.
  switch (entity) {
    case 'risks': return 'level'
    case 'improvements': return 'status'
    case 'value': return 'classification'
    case 'indicators': return 'process'
    case 'assets': return 'criticality'
    case 'applications': return 'deployment'
    case 'cargos': return 'cargo'
    default: return 'macro'
  }
}

// ¿La pregunta nombra un proceso concreto? (para acotar el heatmap). Si pide
// "toda la empresa" o no aparece ningún nombre completo de proceso, es global.
function detectProcess(query: string, data: ScopedData): string | undefined {
  const q = norm(query)
  if (COMPANY_WORDS.test(q)) return undefined
  const hit = data.processes.find((p) => p.name && norm(p.name).length >= 5 && q.includes(norm(p.name)))
  return hit?.name
}

const TITLES: Record<Entity, string> = {
  risks: 'Riesgos', processes: 'Procesos', indicators: 'Indicadores', value: 'Análisis de valor', improvements: 'Mejoras',
  assets: 'Activos de información', applications: 'Aplicaciones', cargos: 'Cargos',
}
const GROUP_TITLES: Record<string, string> = {
  level: 'por nivel', category: 'por categoría', area: 'por área', macro: 'por macroproceso', process: 'por proceso',
  executor: 'por ejecutor', status: 'por estado', type: 'por tipo', priority: 'por prioridad', meta: 'con y sin meta',
  frequency: 'por frecuencia', classification: 'por clasificación (VA/NVA)',
  criticality: 'por criticidad', asset_type: 'por tipo', confidentiality: 'por confidencialidad',
  personal_data: 'con y sin datos personales', deployment: 'por despliegue', ownership: 'por propiedad',
  risk: 'por riesgo tecnológico', api: 'con y sin API', cargo: 'por cargo',
}

export function detectVisual(query: string, data: ScopedData): CopilotWidget | null {
  const q = norm(query)
  const wantsHeatmap = HEATMAP_WORDS.test(q)
  const wantsChart = CHART_WORDS.test(q)
  if (!wantsHeatmap && !wantsChart) return null

  const category = detectCategory(q)

  if (wantsHeatmap) {
    const proc = detectProcess(query, data)
    const params: Record<string, string> = {}
    if (proc) params.process = proc
    if (category) params.category = category
    params.title = proc ? `Mapa de calor · ${proc}` : 'Mapa de calor de riesgos · toda la empresa'
    return { name: 'HEATMAP', params }
  }

  const entity = detectEntity(q)
  const chartType = /pastel|torta|circular|\bpie\b/.test(q) ? 'pie' : 'bar'
  const groupBy = detectGroupBy(q, entity)
  const control = /sin control|no controlad|descontrol/.test(q) ? 'inadequate' : undefined

  const params: Record<string, string> = { entity, groupBy, chartType }
  if (entity === 'risks' && category) params.category = category
  if (entity === 'risks' && control) params.control = control
  const parts = [TITLES[entity], GROUP_TITLES[groupBy] ?? '', category ? `(${category})` : '', control ? 'sin control' : '']
  params.title = parts.filter(Boolean).join(' ')
  return { name: 'CHART', params }
}
