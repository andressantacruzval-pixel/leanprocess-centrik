import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Layers, Brain } from 'lucide-react'
import type { AdminMetrics } from '@/stores/analyticsStore'
import { SectionTitle, Card } from '../components/AdminShared'
import { PURPLE, PIE_COLORS, tooltipStyle, fmtNumber, fmtTokens } from '../adminConstants'

interface Props {
  metrics: AdminMetrics
}

export function EngagementTab({ metrics }: Props) {
  const totalProcesses = metrics.processesPerUser.reduce((s, b) => s + b.count, 0)
  return (
    <div className="space-y-6">

      {/* KPIs procesos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <Layers size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-white/40 uppercase mb-0.5">Total procesos creados</p>
            <p className="text-2xl font-bold text-white">{fmtNumber(totalProcesses)}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <Brain size={18} className="text-cyan-400 shrink-0" />
          <div>
            <p className="text-xs text-white/40 uppercase mb-0.5">Promedio procesos / empresa</p>
            <p className="text-2xl font-bold text-white">{metrics.avgProcessesPerCompany}</p>
          </div>
        </div>
      </div>

      {/* Processes per user distribution */}
      {totalProcesses > 0 && <Card>
        <SectionTitle>Distribucion de Procesos por Empresa</SectionTitle>
        <div className="h-64 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.processesPerUser}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="bucket" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="Usuarios" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {metrics.processesPerUser.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>}

      {/* AI usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI bar chart */}
        <Card>
          <SectionTitle>Uso de IA por Feature (tokens)</SectionTitle>
          <div className="h-72 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.aiUsage} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v: number) => fmtTokens(v)} />
                <YAxis type="category" dataKey="feature" tick={{ fill: '#9ca3af', fontSize: 11 }} width={115} />
                <Tooltip {...tooltipStyle} formatter={(v) => [fmtNumber(v as number), 'Tokens'] as [string, string]} />
                <Bar dataKey="totalTokens" name="Tokens Totales" radius={[0, 6, 6, 0]} maxBarSize={22} fill={PURPLE} fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* AI table */}
        <Card>
          <SectionTitle>Detalle de Consumo IA</SectionTitle>
          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-white/30 text-xs uppercase border-b border-white/5">
                  <th className="text-left py-2 pr-4">Feature</th>
                  <th className="text-right py-2 px-4">Tokens Totales</th>
                  <th className="text-right py-2 pl-4">Prom / Usuario</th>
                </tr>
              </thead>
              <tbody>
                {metrics.aiUsage.map((a) => (
                  <tr key={a.feature} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-white/80 flex items-center gap-2">
                      <Brain size={13} className="text-purple-400" />
                      {a.feature}
                    </td>
                    <td className="py-2.5 px-4 text-right text-white/60">{fmtNumber(a.totalTokens)}</td>
                    <td className="py-2.5 pl-4 text-right text-white/60">{fmtNumber(a.avgPerUser)}</td>
                  </tr>
                ))}
                <tr className="text-white/40 font-medium">
                  <td className="py-2.5 pr-4">Total</td>
                  <td className="py-2.5 px-4 text-right">{fmtNumber(metrics.aiUsage.reduce((s, a) => s + a.totalTokens, 0))}</td>
                  <td className="py-2.5 pl-4 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

    </div>
  )
}
