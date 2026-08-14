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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1424] border border-white/10 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Zap size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Créditos insuficientes</h2>
              <p className="text-white/40 text-xs mt-0.5">
                No tienes créditos suficientes para esta operación.
                Se renuevan el 1° de cada mes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5">
          {onManual && (
            <button
              type="button"
              onClick={() => { onManual(); onClose() }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-left"
            >
              <PenLine size={18} className="text-white/50 shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">Completar manualmente</p>
                <p className="text-white/40 text-xs mt-0.5">Sin IA</p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/50 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
