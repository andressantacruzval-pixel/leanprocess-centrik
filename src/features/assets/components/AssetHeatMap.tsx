import { useMemo } from 'react'
import { heatMapCellColor, getRiskLevel } from '@/types/risk'

// Mapa de calor 5×5 de activos: probabilidad (Y) × impacto mayor de C·I·D (X).
// Igual que el de riesgos, pero enfocado en activos de información.
interface Props {
  points: { p: number; i: number }[]
  label: string
  onCellClick?: (p: number, i: number) => void
  selectedCell?: { p: number; i: number } | null
}

const PROB_ROWS = [5, 4, 3, 2, 1]
const IMP_COLS = [1, 2, 3, 4, 5]

export function AssetHeatMap({ points, label, onCellClick, selectedCell }: Props) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    points.forEach(({ p, i }) => { if (p && i) m[`${p}-${i}`] = (m[`${p}-${i}`] || 0) + 1 })
    return m
  }, [points])

  const globalLevel = useMemo(() => {
    let maxScore = 0, mp = 0, mi = 0
    points.forEach(({ p, i }) => { if (p * i > maxScore) { maxScore = p * i; mp = p; mi = i } })
    return maxScore > 0 ? getRiskLevel(mp, mi) : null
  }, [points])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        {globalLevel && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${globalLevel.color} text-gray-900`}>{globalLevel.label}</span>}
      </div>
      <div className="flex gap-1 items-center">
        <span className="text-[7px] text-gray-400 -rotate-90 whitespace-nowrap select-none">Probabilidad</span>
        <div className="flex gap-1 flex-1">
          <div className="flex flex-col justify-between py-0.5 pr-0.5">
            {PROB_ROWS.map((p) => <div key={p} className="aspect-square flex items-center"><span className="text-[7px] text-gray-400 w-2 text-right">{p}</span></div>)}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-px">
              {PROB_ROWS.map((p) => IMP_COLS.map((i) => {
                const count = counts[`${p}-${i}`] || 0
                return (
                  <button key={`${p}-${i}`} onClick={() => onCellClick?.(p, i)}
                    className={`aspect-square rounded-[2px] flex items-center justify-center text-[7px] font-bold transition-all ${heatMapCellColor(p, i)} ${count > 0 ? 'text-gray-900 shadow-sm ring-1 ring-gray-300' : 'text-gray-300'} ${selectedCell?.p === p && selectedCell?.i === i ? 'ring-2 ring-gray-400 ring-offset-1 ring-offset-black/50 z-10 relative' : ''}`}>
                    {count > 0 ? count : ''}
                  </button>
                )
              }))}
            </div>
            <div className="grid grid-cols-5 gap-px mt-0.5">{IMP_COLS.map((i) => <span key={i} className="text-[7px] text-gray-400 text-center">{i}</span>)}</div>
            <div className="text-center mt-0.5"><span className="text-[7px] text-gray-400 select-none">Impacto (mayor C·I·D)</span></div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-center"><span className="text-[7px] text-gray-400">Total: {points.length}</span></div>
    </div>
  )
}
