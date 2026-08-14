import { useState, useEffect, useRef } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { getNodeDepth } from '@/utils/tree'
import { ORG_LEVEL_COLORS } from '@/lib/constants'
import { X } from 'lucide-react'
import type { OrgUnit } from '@/types'

interface OrgNodeModalProps {
  mode: 'create' | 'edit'
  parentId: string | null
  editUnit?: OrgUnit | null
  onClose: () => void
}

export function OrgNodeModal({ mode, parentId, editUnit, onClose }: OrgNodeModalProps) {
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)
  const addOrgUnit = useCompanyStore((s) => s.addOrgUnit)
  const updateOrgUnit = useCompanyStore((s) => s.updateOrgUnit)
  const [name, setName] = useState(editUnit?.name ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Determine target depth
  let targetDepth = 0
  if (mode === 'create' && parentId) {
    targetDepth = getNodeDepth(parentId, orgUnits) + 1
  } else if (mode === 'edit' && editUnit) {
    targetDepth = getNodeDepth(editUnit.id, orgUnits)
  }

  const levelDef = orgLevelDefinitions.find((ld) => ld.level_number === targetDepth)
  const parentUnit = parentId ? orgUnits.find((u) => u.id === parentId) : null
  const color = ORG_LEVEL_COLORS[targetDepth % ORG_LEVEL_COLORS.length]

  const handleSave = () => {
    if (!name.trim()) return
    if (mode === 'create') {
      addOrgUnit(name.trim(), parentId)
    } else if (mode === 'edit' && editUnit) {
      updateOrgUnit(editUnit.id, { name: name.trim() })
    }
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) handleSave()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[#0d1420] border border-white/10 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">
            {mode === 'create' ? 'Agregar unidad' : 'Editar unidad'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">
              Nombre
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Gerencia General"
              className="w-full px-3 py-2 border border-white/10 rounded-lg bg-white/[0.03] text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
            />
          </div>

          {levelDef && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Nivel organizacional
              </label>
              <span
                className="inline-block px-3 py-1 rounded-full text-white text-sm font-medium"
                style={{ backgroundColor: color }}
              >
                {levelDef.level_name}
              </span>
            </div>
          )}

          {parentUnit && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Depende de
              </label>
              <span className="text-sm text-white/40 bg-white/[0.03] px-3 py-1.5 rounded-lg inline-block">
                {parentUnit.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/70 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
