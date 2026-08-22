import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { computeChart, type ChartSpec, type ChartEntity, type ChartGroupBy, type ControlFilter } from '../../copilotData'

// Paleta por defecto cuando el corte no trae color propio (p. ej. no es "level").
const PALETTE = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#14b8a6']

const ENTITIES = new Set<ChartEntity>(['risks', 'processes'])
const GROUPS = new Set<ChartGroupBy>(['area', 'category', 'level', 'macro', 'process', 'executor'])

function toSpec(params: Record<string, string>): ChartSpec | null {
  const entity = params.entity as ChartEntity
  const groupBy = params.groupBy as ChartGroupBy
  if (!ENTITIES.has(entity) || !GROUPS.has(groupBy)) return null
  const control = params.control as ControlFilter | undefined
  return {
    entity,
    groupBy,
    control: control === 'inadequate' || control === 'none' || control === 'any' ? control : undefined,
    category: params.category || undefined,
    area: params.area || undefined,
    title: params.title || undefined,
  }
}

// Gráfico calculado de forma DETERMINISTA (los números no los pone el modelo).
export function CopilotChart({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const spec = useMemo(() => toSpec(params), [params])
  const datums = useMemo(() => (spec ? computeChart(data, spec) : []), [data, spec])

  if (!spec) return null
  const title = spec.title || 'Gráfico'

  if (!datums.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <BarChart3 size={18} className="mx-auto text-white/25 mb-1.5" />
        <p className="text-[12px] text-white/45">{title}</p>
        <p className="text-[11px] text-white/30 mt-0.5">No hay datos que cumplan ese criterio.</p>
      </div>
    )
  }

  const total = datums.reduce((s, d) => s + d.value, 0)
  const height = Math.max(120, datums.length * 34 + 24)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold text-white/80 inline-flex items-center gap-1.5"><BarChart3 size={13} className="text-cyan-400" /> {title}</span>
        <span className="text-[11px] text-white/35 tabular-nums">Total: {total}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={datums} layout="vertical" margin={{ left: 8, right: 24, top: 2, bottom: 2 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={130} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{ background: '#0d1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {datums.map((d, i) => (
              <Cell key={d.label} fill={d.hex || PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
