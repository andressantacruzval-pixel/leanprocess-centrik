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
      className={`group relative bg-white rounded-lg shadow-md border-2 px-4 py-3 min-w-[180px] max-w-[220px] transition-all hover:shadow-lg ${selected ? 'border-primary-500 shadow-lg' : 'border-gray-200'}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-200 !w-2 !h-2" />

      <div className="text-center">
        <p className="font-semibold text-gray-900 text-sm leading-tight mb-1.5 truncate">
          {unit.name}
        </p>
        {levelDef && (
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-900"
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
              className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
          )}
          {onAddChild && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(unit.id) }}
              className="w-10 h-10 rounded-full border border-primary-200 shadow flex items-center justify-center text-white transition-colors bg-primary-500 hover:bg-primary-600"
              title="Agregar subordinado"
            >
              <Plus size={15} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(unit.id) }}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={13} />
            </button>
          )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-200 !w-2 !h-2" />
    </div>
  )
}

export const OrgNode = memo(OrgNodeComponent)
