import { useState, useMemo } from 'react'
import { X, Search, Building2, ChevronRight } from 'lucide-react'
import { useCompanyStore } from '@/stores/companyStore'
import type { OrgUnit } from '@/types'

interface OrgUnitSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (orgUnitId: string | null) => void
  currentOrgUnitId?: string | null
  leafOnly?: boolean
}

export function OrgUnitSelector({ open, onClose, onSelect, currentOrgUnitId, leafOnly }: OrgUnitSelectorProps) {
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)
  const [search, setSearch] = useState('')

  // Build a path map for display
  const pathMap = useMemo(() => {
    const map = new Map<string, string>()
    const unitMap = new Map<string, OrgUnit>()
    for (const u of orgUnits) unitMap.set(u.id, u)

    const buildPath = (unitId: string): string => {
      if (map.has(unitId)) return map.get(unitId)!
      const unit = unitMap.get(unitId)
      if (!unit) return ''
      const parentPath = unit.parent_id ? buildPath(unit.parent_id) : ''
      const path = parentPath ? `${parentPath} > ${unit.name}` : unit.name
      map.set(unitId, path)
      return path
    }

    for (const u of orgUnits) buildPath(u.id)
    return map
  }, [orgUnits])

  // Check if a unit is a leaf (has no children)
  const leafIds = useMemo(() => {
    const parentIds = new Set(orgUnits.filter((u) => u.parent_id).map((u) => u.parent_id!))
    return new Set(orgUnits.filter((u) => !parentIds.has(u.id)).map((u) => u.id))
  }, [orgUnits])

  // Group by level definition
  const grouped = useMemo(() => {
    const groups: { levelName: string; levelNumber: number; units: OrgUnit[] }[] = []
    const sortedDefs = [...orgLevelDefinitions].sort((a, b) => a.level_number - b.level_number)

    for (const def of sortedDefs) {
      const units = orgUnits
        .filter((u) => u.org_level_definition_id === def.id)
        .sort((a, b) => a.sort_order - b.sort_order)
      if (units.length > 0) {
        groups.push({ levelName: def.level_name, levelNumber: def.level_number, units })
      }
    }

    // Units without matching level def
    const assignedIds = new Set(groups.flatMap((g) => g.units.map((u) => u.id)))
    const unassigned = orgUnits.filter((u) => !assignedIds.has(u.id))
    if (unassigned.length > 0) {
      groups.push({ levelName: 'Sin nivel', levelNumber: 999, units: unassigned })
    }

    return groups
  }, [orgUnits, orgLevelDefinitions])

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return grouped
    const q = search.toLowerCase()
    return grouped
      .map((g) => ({
        ...g,
        units: g.units.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            (pathMap.get(u.id) || '').toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.units.length > 0)
  }, [grouped, search, pathMap])

  // Flat list of leaf units for leafOnly mode
  const filteredLeafUnits = useMemo(() => {
    const leaves = orgUnits.filter((u) => leafIds.has(u.id))
    if (!search.trim()) return leaves
    const q = search.toLowerCase()
    return leaves.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (pathMap.get(u.id) || '').toLowerCase().includes(q)
    )
  }, [orgUnits, leafIds, search, pathMap])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/45" onClick={onClose} />
      <div className="relative bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {leafOnly ? 'Asignar área responsable' : 'Seleccionar area organizacional'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar area..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-300 placeholder:text-gray-400"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {leafOnly ? (
            orgUnits.length === 0 || [...leafIds].length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No hay áreas disponibles.
                <br />
                Crea áreas en la estructura organizacional.
              </div>
            ) : filteredLeafUnits.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No se encontraron resultados para &quot;{search}&quot;
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLeafUnits.map((unit) => {
                  const isSelected = currentOrgUnitId === unit.id
                  const path = pathMap.get(unit.id) || unit.name
                  return (
                    <button
                      key={unit.id}
                      onClick={() => {
                        onSelect(unit.id)
                        onClose()
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <Building2
                        size={16}
                        className={isSelected ? 'text-primary-600' : 'text-gray-400'}
                      />
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm font-medium truncate block ${
                            isSelected ? 'text-primary-600' : 'text-gray-700'
                          }`}
                        >
                          {unit.name}
                        </span>
                        {path !== unit.name && (
                          <div className="flex items-center gap-0.5 text-[11px] text-gray-400 mt-0.5 truncate">
                            {path.split(' > ').map((seg, i, arr) => (
                              <span key={i} className="flex items-center gap-0.5">
                                {i > 0 && <ChevronRight size={10} className="flex-shrink-0" />}
                                <span className={i === arr.length - 1 ? 'font-medium' : ''}>{seg}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          ) : orgUnits.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No hay areas organizacionales configuradas.
              <br />
              Configuralas en el onboarding o ajustes.
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No se encontraron resultados para &quot;{search}&quot;
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.levelNumber}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  {group.levelName}
                </h4>
                <div className="space-y-1">
                  {group.units.map((unit) => {
                    const isLeaf = leafIds.has(unit.id)
                    const isSelected = currentOrgUnitId === unit.id
                    const path = pathMap.get(unit.id) || unit.name

                    return (
                      <button
                        key={unit.id}
                        onClick={() => {
                          onSelect(unit.id)
                          onClose()
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'bg-primary-50 border border-primary-200'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <Building2
                          size={16}
                          className={isSelected ? 'text-primary-600' : 'text-gray-400'}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium truncate ${
                                isSelected ? 'text-primary-600' : 'text-gray-700'
                              }`}
                            >
                              {unit.name}
                            </span>
                            {isLeaf && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-600 font-medium flex-shrink-0">
                                Hoja
                              </span>
                            )}
                          </div>
                          {path !== unit.name && (
                            <div className="flex items-center gap-0.5 text-[11px] text-gray-400 mt-0.5 truncate">
                              {path.split(' > ').map((seg, i, arr) => (
                                <span key={i} className="flex items-center gap-0.5">
                                  {i > 0 && <ChevronRight size={10} className="flex-shrink-0" />}
                                  <span className={i === arr.length - 1 ? 'font-medium' : ''}>
                                    {seg}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Clear assignment */}
        {currentOrgUnitId && (
          <div className="px-6 py-3 border-t border-gray-100">
            <button
              onClick={() => {
                onSelect(null)
                onClose()
              }}
              className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Quitar asignacion
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
