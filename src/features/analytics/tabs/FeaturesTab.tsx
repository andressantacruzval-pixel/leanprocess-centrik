import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { AdminMetrics, FeatureUsageStat } from '@/stores/analyticsStore'
import { SectionTitle, Card } from '../components/AdminShared'
import { CYAN, PLAN_COLORS, PIE_COLORS, tooltipStyle } from '../adminConstants'

type PlanFilter = 'all' | 'free' | 'community' | 'pro' | 'max'

interface Props {
  metrics: AdminMetrics
  planFilter: PlanFilter
  setPlanFilter: (v: PlanFilter) => void
  filteredFeatureUsage: FeatureUsageStat[]
}

export function FeaturesTab({ metrics, planFilter, setPlanFilter, filteredFeatureUsage }: Props) {
  // Series temporales de IA por día (top 5 features)
  const TOP_N = 5
  const featureNames = [...new Set(metrics.featureUsageByDay.map(d => d.feature))]
    .map(f => ({
      name: f,
      total: metrics.featureUsageByDay.filter(d => d.feature === f).reduce((s, d) => s + d.count, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_N)
    .map(f => f.name)

  const dailyMap: Record<string, Record<string, number>> = {}
  for (const row of metrics.featureUsageByDay) {
    if (!dailyMap[row.date]) dailyMap[row.date] = {}
    dailyMap[row.date][row.feature] = (dailyMap[row.date][row.feature] ?? 0) + row.count
  }
  const dailyChartData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, feats]) => ({ date, ...feats }))

  // Funnel de conversión solo si hay datos reales (más de 1 paso con count > 0)
  const funnelHasData = metrics.conversionFunnel.filter(s => s.count > 0).length > 1

  return (
    <div className="space-y-6">
      {/* Plan filter */}
      <div className="flex gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/5 w-fit">
        {([
          { value: 'all' as const,       label: 'Todos',     color: CYAN        },
          { value: 'free' as const,      label: 'Free',      color: PLAN_COLORS[0] },
          { value: 'community' as const, label: 'Community', color: PLAN_COLORS[1] },
          { value: 'pro' as const,       label: 'Pro',       color: PLAN_COLORS[2] },
          { value: 'max' as const,       label: 'Max',       color: PLAN_COLORS[3] },
        ]).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPlanFilter(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${planFilter === opt.value
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
              }`}
          >
            {opt.value !== 'all' && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
            )}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Tabla de adopción — con conteos y barra visual */}
      <Card>
        <SectionTitle>
          Adopción de Features{planFilter !== 'all' ? ` — Plan ${planFilter.charAt(0).toUpperCase() + planFilter.slice(1)}` : ''}
        </SectionTitle>
        {filteredFeatureUsage.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">Sin datos en el periodo seleccionado</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-white/30 text-xs uppercase border-b border-white/5">
                  <th className="text-left py-2 pr-4">Feature</th>
                  <th className="text-right py-2 px-4">Empresas</th>
                  <th className="text-left py-2 px-4 w-1/2">Adopción</th>
                  <th className="text-right py-2 pl-4">%</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeatureUsage.map((f, i) => (
                  <tr key={f.feature} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-white/80">{f.feature}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-white/80">{f.usersCount}</td>
                    <td className="py-2.5 px-4">
                      <div className="w-full bg-white/[0.06] rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${f.percentage}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pl-4 text-right text-white/50">{f.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Funnel de conversión — solo si hay datos */}
      {funnelHasData ? (
        <Card>
          <SectionTitle>Funnel de Conversión</SectionTitle>
          <div className="mt-4 space-y-2">
            {metrics.conversionFunnel.map((s, i) => {
              const color = PIE_COLORS[i % PIE_COLORS.length]
              return (
                <div key={s.step} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-36 text-right shrink-0 truncate">{s.step}</span>
                  <div className="flex-1 flex items-center">
                    <div
                      className="h-8 rounded-lg flex items-center px-3 text-xs font-medium text-white/90 transition-all"
                      style={{ width: `${Math.max(s.percentage, 6)}%`, backgroundColor: color, opacity: 0.75 }}
                    >
                      {s.count > 0 ? s.count : ''}
                    </div>
                  </div>
                  <span className="text-xs text-white/40 w-10 text-right">{s.percentage}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle>Funnel de Conversión</SectionTitle>
          <p className="text-white/30 text-sm text-center py-8">
            Sin suficientes datos para mostrar el funnel en este periodo
          </p>
        </Card>
      )}

      {/* Llamadas IA por día — solo si hay datos */}
      {dailyChartData.length > 0 ? (
        <Card>
          <SectionTitle>Llamadas de IA por día (top {TOP_N} features)</SectionTitle>
          <p className="text-[11px] text-white/30 mt-0.5 mb-3">
            Número de llamadas por feature cada día del periodo
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                {featureNames.map((feat, i) => (
                  <Bar
                    key={feat}
                    dataKey={feat}
                    stackId="a"
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    fillOpacity={0.85}
                    maxBarSize={36}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle>Llamadas de IA por día</SectionTitle>
          <p className="text-white/30 text-sm text-center py-8">
            Sin actividad de IA registrada en el periodo seleccionado
          </p>
        </Card>
      )}
    </div>
  )
}
