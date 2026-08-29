import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Range = '7d' | '30d' | '90d'

interface FeatureStat { tokens: number; usd: number; calls: number }
interface ModelStat { tokens: number; usd: number; calls: number }
interface DailyStat { date: string; tokens: number; usd: number; calls: number }

const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
]

function daysBack(range: Range): number {
  return range === '7d' ? 7 : range === '30d' ? 30 : 90
}

export function AdminBillingReportingTab() {
  const [range, setRange] = useState<Range>('30d')
  const [loading, setLoading] = useState(false)
  const [byFeature, setByFeature] = useState<Record<string, FeatureStat>>({})
  const [byModel, setByModel] = useState<Record<string, ModelStat>>({})
  const [daily, setDaily] = useState<DailyStat[]>([])
  const [totals, setTotals] = useState({ tokens: 0, usd: 0, calls: 0 })

  useEffect(() => {
    void loadData(range)
  }, [range])

  const loadData = async (r: Range) => {
    setLoading(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - daysBack(r))

      const { data } = await supabase
        .from('ai_usage_log')
        .select('feature, model_used, input_tokens, output_tokens, estimated_cost_usd, created_at')
        .gte('created_at', from.toISOString())
        .order('created_at', { ascending: false })
        .limit(5000)

      if (!data) return

      const featureAcc: Record<string, FeatureStat> = {}
      const modelAcc: Record<string, ModelStat> = {}
      const dailyAcc: Record<string, DailyStat> = {}
      let totalTokens = 0
      let totalUsd = 0
      let totalCalls = 0

      for (const row of data) {
        const tokens = (row.input_tokens ?? 0) + (row.output_tokens ?? 0)
        const usd = row.estimated_cost_usd ?? 0
        const featureKey = row.feature ?? 'unknown'
        const modelKey = row.model_used ?? 'unknown'
        const dayKey = new Date(row.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

        if (!featureAcc[featureKey]) featureAcc[featureKey] = { tokens: 0, usd: 0, calls: 0 }
        featureAcc[featureKey].tokens += tokens
        featureAcc[featureKey].usd += usd
        featureAcc[featureKey].calls += 1

        if (!modelAcc[modelKey]) modelAcc[modelKey] = { tokens: 0, usd: 0, calls: 0 }
        modelAcc[modelKey].tokens += tokens
        modelAcc[modelKey].usd += usd
        modelAcc[modelKey].calls += 1

        if (!dailyAcc[dayKey]) dailyAcc[dayKey] = { date: dayKey, tokens: 0, usd: 0, calls: 0 }
        dailyAcc[dayKey].tokens += tokens
        dailyAcc[dayKey].usd += usd
        dailyAcc[dayKey].calls += 1

        totalTokens += tokens
        totalUsd += usd
        totalCalls += 1
      }

      setByFeature(featureAcc)
      setByModel(modelAcc)
      setDaily(Object.values(dailyAcc).slice(0, 14).reverse())
      setTotals({ tokens: totalTokens, usd: totalUsd, calls: totalCalls })
    } finally {
      setLoading(false)
    }
  }

  const sortedFeatures = Object.entries(byFeature).sort((a, b) => b[1].tokens - a[1].tokens)
  const sortedModels = Object.entries(byModel).sort((a, b) => b[1].tokens - a[1].tokens)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Consumo de IA</h2>
        <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                range === r.value
                  ? 'bg-primary-100 text-primary-700 border border-primary-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Llamadas', value: totals.calls.toLocaleString() },
              { label: 'Tokens totales', value: totals.tokens.toLocaleString() },
              { label: 'Costo estimado', value: `$${totals.usd.toFixed(4)}` },
            ].map((m) => (
              <div key={m.label} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-[10px] text-gray-500 uppercase mb-1">{m.label}</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* By feature */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Por herramienta</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 text-[10px] uppercase">
                    <th className="text-left py-1.5 pr-3">Feature</th>
                    <th className="text-right py-1.5 pr-3">Llamadas</th>
                    <th className="text-right py-1.5 pr-3">Tokens</th>
                    <th className="text-right py-1.5">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFeatures.map(([key, stat]) => (
                    <tr key={key} className="border-b border-gray-100 text-gray-600 hover:bg-gray-50">
                      <td className="py-1.5 pr-3 font-mono text-[10px]">{key}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{stat.calls}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{stat.tokens.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-amber-600">${stat.usd.toFixed(4)}</td>
                    </tr>
                  ))}
                  {sortedFeatures.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-300">Sin datos en este periodo</td></tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>

            {/* By model */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Por modelo</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 text-[10px] uppercase">
                    <th className="text-left py-1.5 pr-3">Modelo</th>
                    <th className="text-right py-1.5 pr-3">Llamadas</th>
                    <th className="text-right py-1.5 pr-3">Tokens</th>
                    <th className="text-right py-1.5">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.map(([key, stat]) => (
                    <tr key={key} className="border-b border-gray-100 text-gray-600 hover:bg-gray-50">
                      <td className="py-1.5 pr-3 font-mono text-[10px]">{key}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{stat.calls}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{stat.tokens.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-amber-600">${stat.usd.toFixed(4)}</td>
                    </tr>
                  ))}
                  {sortedModels.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-300">Sin datos en este periodo</td></tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Daily trend */}
          {daily.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Tendencia diaria (últimos 14 días)</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 text-[10px] uppercase">
                    <th className="text-left py-1.5 pr-3">Fecha</th>
                    <th className="text-right py-1.5 pr-3">Llamadas</th>
                    <th className="text-right py-1.5 pr-3">Tokens</th>
                    <th className="text-right py-1.5">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.date} className="border-b border-gray-100 text-gray-600 hover:bg-gray-50">
                      <td className="py-1.5 pr-3 tabular-nums">{d.date}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{d.calls}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{d.tokens.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums text-amber-600">${d.usd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
