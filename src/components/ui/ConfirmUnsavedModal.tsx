interface ConfirmUnsavedModalProps {
  onDiscard: () => void
  onSave: () => void
}

export function ConfirmUnsavedModal({ onDiscard, onSave }: ConfirmUnsavedModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1420] rounded-xl p-5 border border-white/10 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-sm text-white mb-1">Cambios sin guardar</p>
        <p className="text-xs text-white/40 mb-4">¿Qué deseas hacer con los cambios?</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors"
          >
            Salir sin guardar
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-xs bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg transition-colors"
          >
            Guardar y salir
          </button>
        </div>
      </div>
    </div>
  )
}
