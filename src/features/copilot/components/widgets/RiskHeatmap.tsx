import { useMemo } from 'react'
import { Grid3x3 } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { heatMapCellColor, PROBABILITY_LABELS, IMPACT_LABELS } from '@/types/risk'
import { heatmapMatrix, type RiskBasis } from '../../copilotData'

// Matriz de calor 5×5 (probabilidad × impacto) con el conteo real de riesgos.
// Visual "de consultoría" premium; los datos salen del carril determinista.
export function RiskHeatmap({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const basis: RiskBasis = params.basis === 'residual' ? 'residual' : 'inherent'
  const { cells, total } = useMemo(
    () => heatmapMatrix(data, { process: params.process || undefined, category: params.category || undefined, basis }),
    [data, params.process, params.category, basis]
  )
  const title = params.title || `Mapa de calor de riesgos${basis === 'residual' ? ' (residual)' : ''}`

  if (total === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center copilot-fade">
        <Grid3x3 size={18} className="mx-auto text-gray-400 mb-1.5" />
        <p className="text-[12px] text-gray-500">{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">No hay riesgos que cumplan ese criterio.</p>
      </div>
    )
  }

  const max = Math.max(...cells.map((c) => c.count))

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 copilot-fade">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-semibold text-gray-800 inline-flex items-center gap-1.5"><Grid3x3 size={13} className="text-primary-600" /> {title}</span>
        <span className="text-[11px] text-gray-400 tabular-nums">{total} riesgos</span>
      </div>
      <div className="flex gap-1.5">
        {/* Eje Y: impacto */}
        <div className="flex flex-col justify-around items-end pr-0.5 text-[9px] text-gray-500 w-14 shrink-0">
          {[5, 4, 3, 2, 1].map((i) => <span key={i} className="truncate" title={IMPACT_LABELS[i]}>{IMPACT_LABELS[i]}</span>)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-5 gap-1">
            {cells.map((c) => {
              const empty = c.count === 0
              return (
                <div
                  key={`${c.probability}-${c.impact}`}
                  title={`Prob. ${PROBABILITY_LABELS[c.probability]} × Impacto ${IMPACT_LABELS[c.impact]}: ${c.count}`}
                  className={`aspect-square rounded-md flex items-center justify-center text-[12px] font-bold transition-transform hover:scale-105 ${empty ? 'bg-gray-50 text-gray-300' : `${heatMapCellColor(c.probability, c.impact)} text-gray-900`}`}
                  style={empty ? undefined : { boxShadow: c.count === max ? '0 0 0 1.5px rgba(255,255,255,0.35)' : undefined }}
                >
                  {c.count || ''}
                </div>
              )
            })}
          </div>
          {/* Eje X: probabilidad */}
          <div className="grid grid-cols-5 gap-1 mt-1 text-[9px] text-gray-500 text-center">
            {[1, 2, 3, 4, 5].map((p) => <span key={p} className="truncate" title={PROBABILITY_LABELS[p]}>{PROBABILITY_LABELS[p]}</span>)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[9px] text-gray-400">
        <span>← Menor probabilidad · Mayor probabilidad →</span>
      </div>
    </div>
  )
}
