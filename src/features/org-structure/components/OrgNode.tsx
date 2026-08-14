import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import type { OrgUnit, OrgLevelDefinition } from '@/types'
import { ACCIONES_AL_PASAR, ORG_LEVEL_COLORS } from '@/lib/constants'
import { Pencil, Plus, Trash2 } from 'lucide-react'

export interface OrgNodeData {
  unit: OrgUnit
  levelDef: OrgLevelDefinition | null
  depth: number
  onEdit?: (unit: OrgUnit) => void
  onAddChild?: (parentId: string) => void
  onDelete?: (unitId: string) => void
}

function OrgNodeComponent({ data, selected }: NodeProps<OrgNodeData>) {
  const { unit, levelDef, depth, onEdit, onAddChild, onDelete } = data
  const color = ORG_LEVEL_COLORS[depth % ORG_LEVEL_COLORS.length]

  return (
    <div
      className={`group relative bg-[#0d1420] rounded-xl shadow-md border-2 px-4 py-3 min-w-[180px] max-w-[220px] transition-all hover:shadow-lg hover:shadow-cyan-500/10 ${selected ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-white/10'}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/20 !w-2 !h-2" />

      <div className="text-center">
        <p className="font-semibold text-white text-sm leading-tight mb-1.5 truncate">
          {unit.name}
        </p>
        {levelDef && (
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {levelDef.level_name}
          </span>
        )}
      </div>

      {/* Acciones — siempre en el DOM: ver ACCIONES_AL_PASAR. Al seleccionar el nodo
          se fijan visibles, que es el camino que ya existia para el tap. */}
      <div
        className={`absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 ${
          selected ? 'opacity-100' : ACCIONES_AL_PASAR
        }`}
      >
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(unit) }}
              className="w-10 h-10 rounded-full bg-[#0d1420] border border-white/10 shadow flex items-center justify-center text-white/40 hover:text-blue-400 hover:border-blue-400/30 transition-colors"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
          )}
          {onAddChild && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(unit.id) }}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 border border-cyan-500/20 shadow flex items-center justify-center text-white hover:from-cyan-500 hover:to-blue-500 transition-colors"
              title="Agregar subordinado"
            >
              <Plus size={15} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(unit.id) }}
              className="w-10 h-10 rounded-full bg-[#0d1420] border border-white/10 shadow flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-400/30 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-white/20 !w-2 !h-2" />
    </div>
  )
}

export const OrgNode = memo(OrgNodeComponent)
