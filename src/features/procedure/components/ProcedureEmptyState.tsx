import { Sparkles, Loader2, Lock } from 'lucide-react'

interface ProcedureEmptyStateProps {
  generating: boolean
  bpmnXml?: string
  bpmnSummary: string | null
  loadingMessage: string
  onGenerateFromBpmn: () => void
}

export function ProcedureEmptyState({
  generating,
  bpmnXml,
  bpmnSummary,
  loadingMessage,
  onGenerateFromBpmn,
}: ProcedureEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* Loading state */}
      {generating && (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
          <p className="text-sm text-white/60 animate-pulse">{loadingMessage}</p>
          {bpmnSummary && <p className="text-xs text-white/40">{bpmnSummary}</p>}
        </div>
      )}

      {/* Empty state: no BPMN available */}
      {!generating && !bpmnXml && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <Lock className="w-8 h-8 text-white/20" />
          </div>
          <p className="text-sm text-white/40 text-center max-w-md">
            Primero genera el diagrama BPMN para poder crear el procedimiento.
          </p>
        </div>
      )}

      {/* BPMN available: show generate button */}
      {!generating && bpmnXml && (
        <button
          onClick={onGenerateFromBpmn}
          className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
            <Sparkles className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white">Generar Procedimiento desde BPMN</p>
            <p className="text-sm text-white/40 mt-1">
              Analiza el diagrama y crea un procedimiento operativo completo
            </p>
          </div>
        </button>
      )}
    </div>
  )
}
