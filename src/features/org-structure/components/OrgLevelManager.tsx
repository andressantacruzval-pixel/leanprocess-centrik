import { useState } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { ORG_LEVEL_COLORS } from '@/lib/constants'
import { X, Pencil, Trash2, Check, Plus } from 'lucide-react'

interface OrgLevelManagerProps {
  open: boolean
  onClose: () => void
}

export function OrgLevelManager({ open, onClose }: OrgLevelManagerProps) {
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const updateOrgLevelDefinitionName = useCompanyStore((s) => s.updateOrgLevelDefinitionName)
  const addOrgLevelDefinition = useCompanyStore((s) => s.addOrgLevelDefinition)
  const removeOrgLevelDefinition = useCompanyStore((s) => s.removeOrgLevelDefinition)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newLevelName, setNewLevelName] = useState('')

  if (!open) return null

  const hasUnits = (levelId: string) =>
    orgUnits.some((u) => u.org_level_definition_id === levelId)

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id)
    setEditingName(currentName)
  }

  const handleConfirmEdit = (id: string) => {
    if (editingName.trim()) {
      updateOrgLevelDefinitionName(id, editingName.trim())
    }
    setEditingId(null)
    setEditingName('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') handleConfirmEdit(id)
    if (e.key === 'Escape') { setEditingId(null); setEditingName('') }
  }

  const handleAdd = () => {
    if (!newLevelName.trim()) return
    addOrgLevelDefinition(newLevelName.trim())
    setNewLevelName('')
  }

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[#0d1420] border border-white/10 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Gestionar niveles</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Level list */}
        <div className="space-y-2 mb-5 max-h-72 overflow-y-auto">
          {orgLevelDefinitions.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">
              No hay niveles definidos. Agrega uno abajo.
            </p>
          )}
          {orgLevelDefinitions.map((level, index) => {
            const color = ORG_LEVEL_COLORS[index % ORG_LEVEL_COLORS.length]
            const blocked = hasUnits(level.id)
            const isEditing = editingId === level.id

            return (
              <div key={level.id} className="flex items-center gap-3 py-1.5">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {index + 1}
                </span>

                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, level.id)}
                    className="flex-1 px-2 py-1 bg-white/5 border border-cyan-500/50 rounded-lg text-white text-sm focus:outline-none"
                  />
                ) : (
                  <span className="flex-1 text-white text-sm">{level.level_name}</span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <button
                      onClick={() => handleConfirmEdit(level.id)}
                      disabled={!editingName.trim()}
                      className="p-1.5 text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-30"
                    >
                      <Check size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(level.id, level.level_name)}
                      className="p-1.5 text-white/20 hover:text-white/60 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => !blocked && removeOrgLevelDefinition(level.id)}
                    disabled={blocked || orgLevelDefinitions.length <= 1}
                    title={blocked ? 'Hay unidades asignadas a este nivel' : undefined}
                    className="p-1.5 text-white/20 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add new level */}
        <div className="flex items-center gap-2 pt-4 border-t border-white/5">
          <input
            type="text"
            value={newLevelName}
            onChange={(e) => setNewLevelName(e.target.value)}
            onKeyDown={handleAddKeyDown}
            placeholder="Nuevo nivel (ej: Coordinación)"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            disabled={!newLevelName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
