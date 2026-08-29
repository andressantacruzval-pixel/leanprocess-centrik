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
          <div className="w-16 h-16 rounded-lg flex items-center justify-center bg-primary-100">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
          <p className="text-sm text-gray-600 animate-pulse">{loadingMessage}</p>
          {bpmnSummary && <p className="text-xs text-gray-500">{bpmnSummary}</p>}
        </div>
      )}

      {/* Empty state: no BPMN available */}
      {!generating && !bpmnXml && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center">
            <Lock className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500 text-center max-w-md">
            Primero genera el diagrama BPMN para poder crear el procedimiento.
          </p>
        </div>
      )}

      {/* BPMN available: show generate button */}
      {!generating && bpmnXml && (
        <button
          onClick={onGenerateFromBpmn}
          className="flex flex-col items-center gap-4 p-8 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all group"
        >
          <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
            <Sparkles className="w-8 h-8 text-primary-600" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">Generar Procedimiento desde BPMN</p>
            <p className="text-sm text-gray-500 mt-1">
              Analiza el diagrama y crea un procedimiento operativo completo
            </p>
          </div>
        </button>
      )}
    </div>
  )
}
