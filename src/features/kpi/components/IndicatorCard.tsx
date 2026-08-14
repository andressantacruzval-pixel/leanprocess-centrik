import { Pencil, GripVertical, Target, Clock, Calculator } from 'lucide-react'
import { ThresholdBadges } from './ThresholdBadges'
import type { ProcessIndicator } from '@/types/indicator'

interface IndicatorCardProps {
  indicator: ProcessIndicator & { _tempId?: string }
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
}

export function IndicatorCard({ indicator, selected, onToggleSelect, onEdit }: IndicatorCardProps) {
  return (
    <div
      className={`bg-white/[0.03] rounded-xl border-2 transition-all ${
        selected ? 'border-cyan-500/50 shadow-md shadow-cyan-500/10' : 'border-white/5 hover:border-white/10'
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 pt-0.5">
            <GripVertical size={16} className="text-white/20" />
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="w-4 h-4 rounded border-white/10 text-cyan-400 focus:ring-cyan-500/50"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm">{indicator.name}</h3>
            {indicator.objective && (
              <p className="text-xs text-white/40 mt-1 line-clamp-2">{indicator.objective}</p>
            )}
          </div>

          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors"
            title="Editar indicador"
          >
            <Pencil size={16} />
          </button>
        </div>

        {/* Details */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {indicator.formula && (
            <div className="flex items-start gap-2">
              <Calculator size={14} className="text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-white/20">Formula</p>
                <p className="text-xs text-white/70 font-medium">{indicator.formula}</p>
              </div>
            </div>
          )}
          {indicator.target_value && (
            <div className="flex items-start gap-2">
              <Target size={14} className="text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-white/20">Meta</p>
                <p className="text-xs text-white/70 font-medium">{indicator.target_value}</p>
              </div>
            </div>
          )}
          {indicator.frequency && (
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-white/20">Frecuencia</p>
                <p className="text-xs text-white/70 font-medium">{indicator.frequency}</p>
              </div>
            </div>
          )}
          {indicator.unit_of_measure && (
            <div>
              <p className="text-xs text-white/20">Unidad</p>
              <p className="text-xs text-white/70 font-medium">{indicator.unit_of_measure}</p>
            </div>
          )}
        </div>

        {/* Thresholds */}
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs text-white/20 mb-2">Semaforo</p>
          <ThresholdBadges
            greenMin={indicator.threshold_green_min}
            greenMax={indicator.threshold_green_max}
            yellowMin={indicator.threshold_yellow_min}
            yellowMax={indicator.threshold_yellow_max}
            redMin={indicator.threshold_red_min}
            redMax={indicator.threshold_red_max}
          />
        </div>
      </div>
    </div>
  )
}
