interface ConfirmUnsavedModalProps {
  onDiscard: () => void
  onSave: () => void
}

export function ConfirmUnsavedModal({ onDiscard, onSave }: ConfirmUnsavedModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/45">
      <div className="bg-white rounded-lg p-5 border border-gray-200 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-sm text-gray-900 mb-1">Cambios sin guardar</p>
        <p className="text-xs text-gray-500 mb-4">¿Qué deseas hacer con los cambios?</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDiscard}
            className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Salir sin guardar
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-xs text-white rounded-lg transition-colors bg-primary-500 hover:bg-primary-600"
          >
            Guardar y salir
          </button>
        </div>
      </div>
    </div>
  )
}
