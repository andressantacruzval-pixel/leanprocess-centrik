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
  Acciones: { icon: Command, color: 'text-blue-400' },
  Recientes: { icon: Clock, color: 'text-orange-400' },
  Frecuentes: { icon: Star, color: 'text-yellow-400' },
  Procesos: { icon: MapIcon, color: 'text-cyan-400' },
  Riesgos: { icon: ShieldAlert, color: 'text-rose-400' },
  Indicadores: { icon: TrendingUp, color: 'text-emerald-400' },
  Procedimientos: { icon: BookOpen, color: 'text-amber-400' },
  'Unidades Organizacionales': { icon: Building2, color: 'text-violet-400' },
}

export const BADGE_COLORS: Record<ResultCategory, string> = {
  Acciones: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
  Recientes: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
  Frecuentes: 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20',
  Procesos: 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20',
  Riesgos: 'bg-rose-500/10 text-rose-400 ring-rose-500/20',
  Indicadores: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  Procedimientos: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  'Unidades Organizacionales': 'bg-violet-500/10 text-violet-400 ring-violet-500/20',
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
