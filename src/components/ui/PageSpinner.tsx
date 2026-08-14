/**
 * Lightweight Suspense fallback for lazy-loaded routes.
 * Keeps the shell visible while the chunk loads.
 */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-xs text-white/30">Cargando...</span>
      </div>
    </div>
  )
}
