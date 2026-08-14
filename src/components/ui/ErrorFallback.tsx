import { RotateCcw } from 'lucide-react'

interface ErrorFallbackProps {
  error: Error | null
  onReset?: () => void
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const handleReload = () => {
    if (onReset) {
      onReset()
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="text-red-400 text-3xl mb-3">⚠</div>
      <h2 className="text-base font-semibold text-slate-200 mb-1">Algo salió mal</h2>
      {error?.message && (
        <p className="text-xs text-slate-400 mb-4 max-w-sm">{error.message}</p>
      )}
      <button
        onClick={handleReload}
        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
      >
        <RotateCcw size={14} />
        Recargar
      </button>
    </div>
  )
}
