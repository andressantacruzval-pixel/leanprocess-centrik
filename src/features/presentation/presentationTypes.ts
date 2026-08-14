import type { ElementType } from 'react'
import { Presentation, Map, LayoutGrid, BarChart3, ShieldAlert, TrendingUp, Activity, CheckSquare } from 'lucide-react'

// ── Slide type ────────────────────────────────────────────────────────────

export interface Slide {
  type: 'title' | 'map-overview' | 'macroprocess' | 'summary' | 'risk-heatmap' | 'kpi-dashboard' | 'value-analysis' | 'coverage' | 'org-stats'
  title: string
  data?: unknown
}

// ── Slide metadata for the selector ──────────────────────────────────────

export const slideDescriptions: Record<Slide['type'], string> = {
  title: 'Muestra titulo, fecha y nombre de la aplicacion',
  'map-overview': 'Vista general de todos los macroprocesos por categoria',
  macroprocess: 'Detalle y subprocesos del macroproceso',
  summary: 'Resumen de metricas clave',
  'risk-heatmap': 'Matriz de riesgos organizacional',
  'kpi-dashboard': 'KPIs definidos por proceso',
  'value-analysis': 'Clasificacion de actividades VA/NVA/NVABN',
  coverage: 'Estado de documentacion de cada proceso',
  'org-stats': 'Metricas clave de la organizacion',
}

export const slideIcons: Record<Slide['type'], ElementType> = {
  title: Presentation,
  'map-overview': Map,
  macroprocess: LayoutGrid,
  summary: BarChart3,
  'risk-heatmap': ShieldAlert,
  'kpi-dashboard': TrendingUp,
  'value-analysis': Activity,
  coverage: CheckSquare,
  'org-stats': BarChart3,
}
