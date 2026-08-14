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
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-white/[0.03] border-b border-white/5">
      <div className="flex items-center gap-2">
        {!hasRoot && (
          <button
            onClick={onAddRoot}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-colors"
          >
            <Plus size={14} />
            Agregar raiz
          </button>
        )}
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 text-white/70 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
        >
          <LayoutGrid size={14} />
          Auto-layout
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-white/40">
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
