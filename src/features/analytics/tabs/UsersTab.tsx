import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Users, Activity, CalendarDays, CalendarRange, Calendar, DollarSign, Cpu } from 'lucide-react'
import type { AdminMetrics, DateRange } from '@/stores/analyticsStore'
import { KpiCard, SectionTitle, Card, AlertBanner } from '../components/AdminShared'
import {
  CYAN, BLUE, EMERALD, AMBER, PLAN_COLORS, ONBOARDING_STATE_COLORS,
  tooltipStyle, fmtNumber,
} from '../adminConstants'

interface Props {
  metrics: AdminMetrics
  range: DateRange
  alerts: { key: string; variant: 'red' | 'amber'; message: string }[]
  dismissedAlerts: Set<string>
  dismissAlert: (key: string) => void
  planData: { name: string; value: number }[]
}

const ONBOARDING_LABELS: Record<string, string> = {
  completed:   'Completado',
  in_progress: 'En progreso',
  not_started: 'No iniciado',
}

export function UsersTab({ metrics, range, alerts, dismissedAlerts, dismissAlert, planData }: Props) {
  const dauLabel = range === '7d' ? '7' : range === '90d' ? '90' : range === 'all' ? '180' : '30'

  const onboardingPieData = metrics.onboardingStateDistribution
    .filter(d => d.count > 0)
    .map(d => ({ name: ONBOARDING_LABELS[d.state] ?? d.state, value: d.count }))

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {alerts.filter(a => !dismissedAlerts.has(a.key)).length > 0 && (
        <div className="space-y-2">
          {alerts.filter(a => !dismissedAlerts.has(a.key)).map(a => (
            <AlertBanner key={a.key} variant={a.variant} message={a.message} onDismiss={() => dismissAlert(a.key)} />
          ))}
        </div>
      )}

      {/* KPI row — totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users}      label="Total Usuarios"   value={fmtNumber(metrics.totalUsers)}        color={CYAN}    sub="con empresa en LeanProcess" />
        <KpiCard icon={Activity}   label="Con Onboarding"   value={fmtNumber(metrics.byStatus.active)}   color={EMERALD} sub="onboarding completado" />
        <KpiCard icon={DollarSign} label="Gasto Total IA"   value={`$${metrics.totalAiCostUsd.toFixed(2)}`} color={AMBER} sub="USD en el periodo" />
        <KpiCard icon={Cpu}        label="Features / Usuario" value={String(metrics.avgFeaturesPerUser)} color={BLUE}    sub="promedio de features usadas" />
      </div>

      {/* KPI row — actividad */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={CalendarDays}  label="Activos hoy"        value={fmtNumber(metrics.activeToday)}     color={EMERALD} sub="usaron IA hoy" />
        <KpiCard icon={CalendarRange} label="Activos esta semana" value={fmtNumber(metrics.activeThisWeek)}  color={BLUE}    sub="usaron IA en 7 días" />
        <KpiCard icon={Calendar}      label="Activos este mes"    value={fmtNumber(metrics.activeThisMonth)} color={CYAN}    sub="usaron IA en 30 días" />
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribución por plan */}
        <Card>
          <SectionTitle>Distribucion por Plan</SectionTitle>
          <div className="h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="value" nameKey="name" paddingAngle={3} stroke="none">
                  {planData.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Estado de onboarding */}
        <Card>
          <SectionTitle>Estado de Onboarding</SectionTitle>
          {onboardingPieData.length > 0 ? (
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={onboardingPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" nameKey="name" paddingAngle={3} stroke="none">
                    {onboardingPieData.map((_, i) => <Cell key={i} fill={ONBOARDING_STATE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-white/30 text-sm mt-3">Sin datos de onboarding aún</div>
          )}
        </Card>
      </div>

      {/* Usuarios activos por día */}
      <Card>
        <SectionTitle>Usuarios activos por día (últimos {dauLabel} días)</SectionTitle>
        <p className="text-[11px] text-white/30 mt-0.5 mb-3">Usuarios únicos que usaron IA en cada día</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.dailyActiveUsers}>
              <defs>
                <linearGradient id="dauGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CYAN} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="count" stroke={CYAN} fill="url(#dauGrad)" strokeWidth={2} name="Usuarios activos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Registros por día */}
      <Card>
        <SectionTitle>Registros por día (nuevos usuarios)</SectionTitle>
        <p className="text-[11px] text-white/30 mt-0.5 mb-3">Nuevas cuentas creadas cada día en el periodo</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.registrationsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="Registros" fill={EMERALD} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Actividad real — tokens */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <SectionTitle>Uso de IA (tokens totales en periodo)</SectionTitle>
          <div className="flex items-center gap-8 mt-3 flex-wrap">
            <div>
              <p className="text-xs text-white/40 mb-1">Total tokens</p>
              <p className="text-2xl font-bold text-white">{fmtNumber(metrics.aiUsage.reduce((s, a) => s + a.totalTokens, 0))}</p>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-1">Costo estimado</p>
              <p className="text-2xl font-bold text-amber-400">${metrics.totalAiCostUsd.toFixed(2)} USD</p>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-1">Usuarios que usaron IA</p>
              <p className="text-2xl font-bold text-white">{fmtNumber(new Set(metrics.aiUsage.map(() => 0)).size || metrics.aiUsage.reduce((s, a) => s + (a.avgPerUser > 0 ? 1 : 0), 0))}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
