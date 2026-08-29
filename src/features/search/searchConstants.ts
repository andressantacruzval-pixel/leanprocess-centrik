import type { ElementType } from 'react'
import {
  Map as MapIcon,
  ShieldAlert,
  TrendingUp,
  BookOpen,
  Building2,
  Command,
  Plus,
  FileText,
  Settings,
  Clock,
  Star,
  Flame,
  BarChart3,
  Trophy,
  Presentation,
  Code2,
  ShieldCheck,
  LayoutDashboard,
  Network,
  Lightbulb,
  UserCog,
  IdCard,
  Sparkles,
  Activity,
  ClipboardCheck,
  Boxes,
  Database,
  MonitorSmartphone,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────

export type ResultCategory =
  | 'Acciones'
  | 'Recientes'
  | 'Frecuentes'
  | 'Procesos'
  | 'Riesgos'
  | 'Indicadores'
  | 'Procedimientos'
  | 'Unidades Organizacionales'
  | 'Activos de Información'
  | 'Aplicaciones'

export interface SearchResult {
  id: string
  category: ResultCategory
  title: string
  description: string
  path: string
  icon: ElementType
}

export interface QuickAction {
  id: string
  label: string
  path: string
  icon: ElementType
}

// ── Category metadata ────────────────────────────────────────────────────

export const CATEGORY_META: Record<ResultCategory, { icon: ElementType; color: string }> = {
  Acciones: { icon: Command, color: 'text-blue-600' },
  Recientes: { icon: Clock, color: 'text-amber-600' },
  Frecuentes: { icon: Star, color: 'text-amber-600' },
  Procesos: { icon: MapIcon, color: 'text-primary-600' },
  Riesgos: { icon: ShieldAlert, color: 'text-red-600' },
  Indicadores: { icon: TrendingUp, color: 'text-emerald-600' },
  Procedimientos: { icon: BookOpen, color: 'text-amber-600' },
  'Unidades Organizacionales': { icon: Building2, color: 'text-primary-600' },
  'Activos de Información': { icon: Database, color: 'text-primary-600' },
  Aplicaciones: { icon: MonitorSmartphone, color: 'text-primary-600' },
}

export const BADGE_COLORS: Record<ResultCategory, string> = {
  Acciones: 'bg-blue-50 text-blue-600 ring-blue-500',
  Recientes: 'bg-amber-50 text-amber-600 ring-amber-500',
  Frecuentes: 'bg-amber-50 text-amber-600 ring-amber-500',
  Procesos: 'bg-primary-50 text-primary-600 ring-primary-500',
  Riesgos: 'bg-red-50 text-red-600 ring-red-500',
  Indicadores: 'bg-emerald-50 text-emerald-600 ring-emerald-500',
  Procedimientos: 'bg-amber-50 text-amber-600 ring-amber-500',
  'Unidades Organizacionales': 'bg-primary-50 text-primary-600 ring-primary-500',
  'Activos de Información': 'bg-primary-50 text-primary-600 ring-primary-500',
  Aplicaciones: 'bg-primary-50 text-primary-600 ring-primary-500',
}

// ── Path display names & icons ───────────────────────────────────────────

export const PATH_DISPLAY_NAMES: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/process-map': 'Mapa de Procesos',
  '/app/process-levels': 'Procesos por Niveles',
  '/app/heat-map': 'Mapa de Calor',
  '/app/reports': 'Reportes',
  '/app/achievements': 'Logros',
  '/app/org-structure': 'Estructura Organizacional',
  '/app/indicators': 'Indicadores',
  '/app/ai-consultant': 'Consultor IA',
  '/app/catalogs': 'Catalogos',
  '/app/settings': 'Configuracion',
  '/app/admin': 'Admin',
  '/app/presentation': 'Presentacion',
  '/app/api-docs': 'API',
}

export const PATH_ICONS: Record<string, ElementType> = {
  '/app/dashboard': LayoutDashboard,
  '/app/process-map': MapIcon,
  '/app/process-levels': Network,
  '/app/heat-map': Flame,
  '/app/reports': BarChart3,
  '/app/achievements': Trophy,
  '/app/org-structure': Building2,
  '/app/indicators': TrendingUp,
  '/app/ai-consultant': Sparkles,
  '/app/catalogs': Boxes,
  '/app/settings': Settings,
  '/app/admin': ShieldCheck,
  '/app/presentation': Presentation,
  '/app/api-docs': Code2,
}

// ── Quick actions ────────────────────────────────────────────────────────

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'action-crear-proceso', label: 'Crear proceso', path: '/app/process-map', icon: Plus },
  { id: 'action-crear-macroproceso', label: 'Crear macroproceso', path: '/app/process-map', icon: Plus },
  { id: 'action-ver-reportes', label: 'Ver reportes', path: '/app/reports', icon: FileText },
  // Reportes por pestaña (deep-link ?tab=)
  { id: 'action-reporte-inventario', label: 'Reporte de inventario', path: '/app/reports?tab=inventario', icon: Boxes },
  { id: 'action-reporte-riesgos', label: 'Reporte de riesgos', path: '/app/reports?tab=riesgos', icon: ShieldAlert },
  { id: 'action-reporte-kpis', label: 'Reporte de KPIs', path: '/app/reports?tab=kpis', icon: TrendingUp },
  { id: 'action-reporte-valor', label: 'Reporte de analisis de valor', path: '/app/reports?tab=valor', icon: Activity },
  { id: 'action-reporte-auditoria', label: 'Reporte de auditoria', path: '/app/reports?tab=auditoria', icon: ClipboardCheck },
  { id: 'action-reporte-mejoras', label: 'Reporte de mejoras', path: '/app/reports?tab=mejoras', icon: Lightbulb },
  { id: 'action-reporte-cargos', label: 'Reporte de cargos', path: '/app/reports?tab=cargos', icon: UserCog },
  { id: 'action-manuales-cargo', label: 'Manuales de cargo', path: '/app/reports?tab=manuales', icon: IdCard },
  { id: 'action-reporte-activos', label: 'Reporte de activos de información', path: '/app/reports?tab=activos', icon: Database },
  { id: 'action-reporte-aplicaciones', label: 'Reporte de aplicaciones', path: '/app/reports?tab=aplicaciones', icon: MonitorSmartphone },
  { id: 'action-data-journey', label: 'Data Journey (viaje del dato)', path: '/app/data-journey', icon: Network },
  { id: 'action-inventario-apps', label: 'Inventario de aplicaciones', path: '/app/catalogs?tab=__applications__', icon: MonitorSmartphone },
  { id: 'action-ver-mapa-calor', label: 'Ver mapa de calor', path: '/app/heat-map', icon: Flame },
  { id: 'action-ver-indicadores', label: 'Ver indicadores', path: '/app/indicators', icon: TrendingUp },
  { id: 'action-estructura-organizacional', label: 'Estructura organizacional', path: '/app/org-structure', icon: Building2 },
  { id: 'action-consultor-ia', label: 'Consultor IA', path: '/app/ai-consultant', icon: Sparkles },
  { id: 'action-catalogos', label: 'Catalogos', path: '/app/catalogs', icon: Boxes },
  { id: 'action-ver-logros', label: 'Ver logros', path: '/app/achievements', icon: Trophy },
  { id: 'action-ver-presentacion', label: 'Ver presentacion', path: '/app/presentation', icon: Presentation },
  { id: 'action-ver-api-docs', label: 'Ver API docs', path: '/app/api-docs', icon: Code2 },
  { id: 'action-ver-admin', label: 'Ver admin', path: '/app/admin', icon: ShieldCheck },
  { id: 'action-exportar-reporte', label: 'Exportar reporte', path: '/app/reports', icon: FileText },
  { id: 'action-configuracion', label: 'Configuracion', path: '/app/settings', icon: Settings },
]

export const MAX_RESULTS = 20

// ── fuzzyMatch ───────────────────────────────────────────────────────────

export function fuzzyMatch(text: string, query: string): number {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  if (lower === q) return 3
  if (lower.startsWith(q)) return 2
  if (lower.includes(q)) return 1
  return 0
}
