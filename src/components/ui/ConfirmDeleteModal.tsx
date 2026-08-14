import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  title?: string
  description?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteModal({ open, title, description, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-[#0d1424] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">
                {title ?? '¿Eliminar este elemento?'}
              </h2>
              <p className="text-white/40 text-sm mt-0.5">
                Esta acción no se puede deshacer. Los datos se eliminarán permanentemente.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-white/30 hover:text-white/60 transition-colors ml-2 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {description && (
          <p className="text-white/50 text-sm mb-4 pl-13">{description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-white/15 text-white/60 text-sm hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
