import { useMemo } from 'react'
import type { RiskItem } from '@/types/risk'
import { heatMapCellColor, getRiskLevel } from '@/types/risk'

interface MiniHeatMapProps {
  risks: RiskItem[]
  type?: 'inherent' | 'residual'
  onCellClick?: (prob: number, imp: number) => void
  selectedCell?: { p: number; i: number } | null
}

const PROB_ROWS = [5, 4, 3, 2, 1]
const IMP_COLS = [1, 2, 3, 4, 5]

export function MiniHeatMap({ risks, type = 'inherent', onCellClick, selectedCell }: MiniHeatMapProps) {
  // Count risks per cell
  const cellCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    risks.forEach((r) => {
      const p = type === 'inherent' ? r.inherentProbability : r.residualProbability
      const i = type === 'inherent' ? r.inherentImpact : r.residualImpact
      const key = `${p}-${i}`
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [risks, type])

  // Global risk level
  const globalLevel = useMemo(() => {
    if (risks.length === 0) return null
    let maxScore = 0
    let maxP = 1
    let maxI = 1
    risks.forEach((r) => {
      const p = type === 'inherent' ? r.inherentProbability : r.residualProbability
      const i = type === 'inherent' ? r.inherentImpact : r.residualImpact
      const s = p * i
      if (s > maxScore) { maxScore = s; maxP = p; maxI = i }
    })
    return getRiskLevel(maxP, maxI)
  }, [risks, type])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
          Riesgo {type === 'inherent' ? 'Inherente' : 'Residual'}
        </span>
        {globalLevel && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${globalLevel.color} text-white`}>
            {globalLevel.label}
          </span>
        )}
      </div>

      <div className="flex gap-1 items-center">
        {/* Label eje Y */}
        <span className="text-[7px] text-white/30 -rotate-90 whitespace-nowrap select-none">
          Probabilidad
        </span>

        <div className="flex gap-1 flex-1">
          {/* Y-axis numbers */}
          <div className="flex flex-col justify-between py-0.5 pr-0.5">
            {PROB_ROWS.map((p) => (
              <div key={p} className="aspect-square flex items-center">
                <span className="text-[7px] text-white/30 w-2 text-right">{p}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-px">
              {PROB_ROWS.map((p) =>
                IMP_COLS.map((i) => {
                  const key = `${p}-${i}`
                  const count = cellCounts[key] || 0
                  return (
                    <button
                      key={key}
                      onClick={() => onCellClick?.(p, i)}
                      className={`aspect-square rounded-[2px] flex items-center justify-center text-[7px] font-bold transition-all ${heatMapCellColor(p, i)} ${
                        count > 0
                          ? 'text-white shadow-sm ring-1 ring-white/20'
                          : 'text-white/20'
                      } ${
                        selectedCell?.p === p && selectedCell?.i === i
                          ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-black/50 z-10 relative'
                          : ''
                      }`}
                    >
                      {count > 0 ? count : ''}
                    </button>
                  )
                })
              )}
            </div>
            {/* X-axis numbers */}
            <div className="grid grid-cols-5 gap-px mt-0.5">
              {IMP_COLS.map((i) => (
                <span key={i} className="text-[7px] text-white/30 text-center">{i}</span>
              ))}
            </div>
            {/* Label eje X */}
            <div className="text-center mt-0.5">
              <span className="text-[7px] text-white/30 select-none">Impacto</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 justify-center">
        <span className="text-[7px] text-white/30">Total: {risks.length}</span>
      </div>
    </div>
  )
}
