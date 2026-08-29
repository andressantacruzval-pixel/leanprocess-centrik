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
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold text-base">
                {title ?? '¿Eliminar este elemento?'}
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Esta acción no se puede deshacer. Los datos se eliminarán permanentemente.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-2 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {description && (
          <p className="text-gray-500 text-sm mb-4 pl-13">{description}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
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
