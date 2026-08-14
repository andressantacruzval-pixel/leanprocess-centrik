import type { DateRange } from '@/stores/analyticsStore'
import { Users, Activity, DollarSign, Layers, Trophy, Zap, UserCheck } from 'lucide-react'

// ── Palette ──────────────────────────────────────────────────────────────
export const CYAN    = '#06b6d4'
export const BLUE    = '#3b82f6'
export const EMERALD = '#10b981'
export const AMBER   = '#f59e0b'
export const RED     = '#ef4444'
export const PURPLE  = '#a855f7'

export const PLAN_COLORS   = [CYAN, BLUE, EMERALD, PURPLE]
export const STATUS_COLORS = [AMBER, EMERALD, RED, '#6b7280', PURPLE]
export const PIE_COLORS    = [CYAN, BLUE, EMERALD, AMBER, RED, PURPLE]

// ── Tabs ─────────────────────────────────────────────────────────────────
export const TABS = [
  { id: 'users',        label: 'Metricas de Usuarios', icon: Users },
  { id: 'features',     label: 'Adopcion de Features',  icon: Layers },
  { id: 'engagement',   label: 'Engagement',             icon: Activity },
  { id: 'user_detail',  label: 'Detalle Usuarios',       icon: UserCheck },
  { id: 'revenue',      label: 'Revenue',                icon: DollarSign },
  { id: 'achievements', label: 'Logros',                 icon: Trophy },
  { id: 'ai_usage',     label: 'Uso de IA',              icon: Zap },
] as const
export type TabId = (typeof TABS)[number]['id']

export const ONBOARDING_STATE_COLORS = [EMERALD, AMBER, '#6b7280']

export const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d',     label: '7 dias'   },
  { value: '30d',    label: '30 dias'  },
  { value: '90d',    label: '90 dias'  },
  { value: 'all',    label: 'Todo'     },
  { value: 'custom', label: 'Custom'   },
]

// ── Tooltip style ─────────────────────────────────────────────────────────
export const tooltipStyle = {
  contentStyle: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#9ca3af' },
  itemStyle: { color: '#e5e7eb' },
}

// ── Format helpers ────────────────────────────────────────────────────────
export const fmtCurrency = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
export const fmtNumber   = (n: number) => n.toLocaleString('en-US')
export const fmtPct      = (n: number) => `${n}%`
export const fmtTokens   = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
