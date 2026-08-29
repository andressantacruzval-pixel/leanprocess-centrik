import { useCompanyStore } from '@/stores/companyStore'
import { Plus, LayoutGrid, Users, Layers } from 'lucide-react'

interface OrgToolbarProps {
  onAddRoot: () => void
  onAutoLayout: () => void
}

export function OrgToolbar({ onAddRoot, onAutoLayout }: OrgToolbarProps) {
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)

  const hasRoot = orgUnits.some((u) => u.parent_id === null)

  // Count distinct levels used
  const usedLevels = new Set(orgUnits.map((u) => u.org_level_definition_id)).size

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center gap-2">
        {!hasRoot && (
          <button
            onClick={onAddRoot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-sm font-medium transition-colors bg-primary-500 hover:bg-primary-600"
          >
            <Plus size={14} />
            Agregar raiz
          </button>
        )}
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <LayoutGrid size={14} />
          Auto-layout
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users size={14} />
          {orgUnits.length} unidades
        </span>
        <span className="flex items-center gap-1">
          <Layers size={14} />
          {usedLevels} / {orgLevelDefinitions.length} niveles
        </span>
      </div>
    </div>
  )
}
