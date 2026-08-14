import { useState } from 'react'
import { GripVertical, Pencil, Trash2, ChevronRight } from 'lucide-react'
import type { Macroprocess } from '@/types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { ACCIONES_AL_PASAR } from '@/lib/constants'

interface ProcessCardProps {
  macro: Macroprocess
  childCount: number
  levelName: string
  onDrillDown: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, id: string) => void
}

export function ProcessCard({
  macro,
  childCount,
  levelName,
  onDrillDown,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: ProcessCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleDeleteRequest = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmOpen(true)
  }

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, macro.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, macro.id)}
        onClick={onDrillDown}
        className="relative flex-shrink-0 w-40 sm:w-48 bg-white/[0.03] hover:bg-white/5 rounded-lg shadow-md border border-white/5
                   cursor-pointer transition-all duration-200 group select-none"
      >
        {/* Drag handle */}
        <div className="absolute top-2 left-1.5 text-white/40 group-hover:text-white/20 cursor-grab active:cursor-grabbing">
          <GripVertical size={14} />
        </div>

        {/* Action buttons — siempre en el DOM: ver ACCIONES_AL_PASAR */}
        <div className={`absolute top-1 right-1 flex gap-0.5 z-10 ${ACCIONES_AL_PASAR}`}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-2 rounded bg-white/[0.03] hover:bg-gradient-to-r hover:from-cyan-600 hover:to-blue-600 text-white/30 hover:text-white transition-colors"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleDeleteRequest}
            className="p-2 rounded bg-white/[0.03] hover:bg-red-600 text-white/30 hover:text-white transition-colors"
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="p-4 pt-3">
          <h4 className="text-sm font-semibold text-white leading-tight line-clamp-2 pr-6">
            {macro.name}
          </h4>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-white/30">
              {childCount} {childCount === 1 ? levelName.toLowerCase() : (levelName.toLowerCase() + 's')}
            </span>
            <ChevronRight size={14} className="text-white/40 group-hover:text-cyan-400 transition-colors" />
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirmOpen}
        title={`¿Eliminar el macroproceso «${macro.name}»?`}
        description="Se eliminarán todos los procesos y subprocesos que contiene."
        onConfirm={() => { onDelete(); setConfirmOpen(false) }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
