import { Zap, PenLine, X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  operationKey?: string
  onManual?: () => void
}

export function InsufficientTokensModal({ open, onClose, onManual }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45">
      <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Zap size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold text-sm">Créditos insuficientes</h2>
              <p className="text-gray-500 text-xs mt-0.5">
                No tienes créditos suficientes para esta operación.
                Se renuevan el 1° de cada mes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5">
          {onManual && (
            <button
              type="button"
              onClick={() => { onManual(); onClose() }}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all text-left"
            >
              <PenLine size={18} className="text-gray-500 shrink-0" />
              <div>
                <p className="text-gray-900 text-sm font-medium">Completar manualmente</p>
                <p className="text-gray-500 text-xs mt-0.5">Sin IA</p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all text-gray-500 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
