import { useState } from 'react'
import { IndicatorCard } from './IndicatorCard'
import { IndicatorEditModal } from './IndicatorEditModal'
import type { ProcessIndicator } from '@/types/indicator'

type TempIndicator = ProcessIndicator & { _tempId?: string }

interface IndicatorsListProps {
  indicators: TempIndicator[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onUpdateIndicator: (id: string, updated: Partial<ProcessIndicator>) => void
}

export function IndicatorsList({
  indicators,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onUpdateIndicator,
}: IndicatorsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingIndicator = indicators.find((ind) => (ind._tempId || ind.id) === editingId)
  const allSelected = indicators.length > 0 && selectedIds.size === indicators.length

  return (
    <div>
      {/* Bulk actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white/40">
          {selectedIds.size} de {indicators.length} indicadores seleccionados
        </p>
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
        >
          {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {indicators.map((indicator) => {
          const uid = indicator._tempId || indicator.id
          return (
            <IndicatorCard
              key={uid}
              indicator={indicator}
              selected={selectedIds.has(uid)}
              onToggleSelect={() => onToggleSelect(uid)}
              onEdit={() => setEditingId(uid)}
            />
          )
        })}
      </div>

      {/* Edit modal */}
      {editingIndicator && editingId && (
        <IndicatorEditModal
          indicator={editingIndicator}
          open={!!editingId}
          onClose={() => setEditingId(null)}
          onSave={(updated) => {
            onUpdateIndicator(editingId, updated as Partial<ProcessIndicator>)
          }}
        />
      )}
    </div>
  )
}
