import { useMemo } from 'react'
import { Grid3x3 } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { heatMapCellColor, PROBABILITY_LABELS, IMPACT_LABELS } from '@/types/risk'
import { heatmapMatrix } from '../../copilotData'

// Matriz de calor 5×5 (probabilidad × impacto) con el conteo real de riesgos.
// Visual "de consultoría" premium; los datos salen del carril determinista.
export function RiskHeatmap({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const { cells, total } = useMemo(
    () => heatmapMatrix(data, { process: params.process || undefined, category: params.category || undefined }),
    [data, params.process, params.category]
  )
  const title = params.title || 'Mapa de calor de riesgos'

  if (total === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center copilot-fade">
        <Grid3x3 size={18} className="mx-auto text-white/25 mb-1.5" />
        <p className="text-[12px] text-white/45">{title}</p>
        <p className="text-[11px] text-white/30 mt-0.5">No hay riesgos que cumplan ese criterio.</p>
      </div>
    )
  }

  const max = Math.max(...cells.map((c) => c.count))

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 copilot-fade">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-semibold text-white/80 inline-flex items-center gap-1.5"><Grid3x3 size={13} className="text-cyan-400" /> {title}</span>
        <span className="text-[11px] text-white/35 tabular-nums">{total} riesgos</span>
      </div>
      <div className="flex gap-1.5">
        {/* Eje Y: impacto */}
        <div className="flex flex-col justify-around items-end pr-0.5 text-[9px] text-white/40 w-14 shrink-0">
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
                  className={`aspect-square rounded-md flex items-center justify-center text-[12px] font-bold transition-transform hover:scale-105 ${empty ? 'bg-white/[0.03] text-white/20' : `${heatMapCellColor(c.probability, c.impact)} text-white`}`}
                  style={empty ? undefined : { boxShadow: c.count === max ? '0 0 0 1.5px rgba(255,255,255,0.35)' : undefined }}
                >
                  {c.count || ''}
                </div>
              )
            })}
          </div>
          {/* Eje X: probabilidad */}
          <div className="grid grid-cols-5 gap-1 mt-1 text-[9px] text-white/40 text-center">
            {[1, 2, 3, 4, 5].map((p) => <span key={p} className="truncate" title={PROBABILITY_LABELS[p]}>{PROBABILITY_LABELS[p]}</span>)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[9px] text-white/30">
        <span>← Menor probabilidad · Mayor probabilidad →</span>
      </div>
    </div>
  )
}
