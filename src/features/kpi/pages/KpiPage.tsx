import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, GitBranch, Settings2, Book } from 'lucide-react'
import { useProcessStore } from '@/stores/processStore'
import { IndicatorsTab } from '@/features/kpi/components/IndicatorsTab'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'
import { processMapUrl } from '@/lib/processMapUrl'

export default function KpiPage() {
  const { processId } = useParams<{ processId: string }>()
  const navigate = useNavigate()

  // Solo se documenta en el nivel más bajo declarado — ver @/lib/processLevels.
  useDocumentableGuard(processId)

  const processes = useProcessStore((s) => s.processes)
  const macroprocesses = useProcessStore((s) => s.macroprocesses)

  const process = processes.find((p) => p.id === processId)

  const hierarchy = useMemo(() => {
    if (!process) return { macro: null, parent: null }
    const macro = macroprocesses.find((m) => m.id === process.macroprocess_id)
    let parent: typeof processes[number] | null = null
    if (process.parent_process_id) {
      parent = processes.find((p) => p.id === process.parent_process_id) || null
    }
    return { macro, parent }
  }, [process, macroprocesses, processes])

  if (!process) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/30">
        <p className="text-lg">Proceso no encontrado</p>
        <button onClick={() => navigate(processMapUrl(process))} className="mt-4 text-cyan-400 hover:underline">Volver al mapa</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 lg:-m-6 bg-[#070b14]">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#0a0f1a] border-b border-white/5 shrink-0 overflow-x-auto">
        {/* Back */}
        <button
          onClick={() => navigate(`/app/process/${processId}`)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-white/30 mr-3">
          {hierarchy.macro && (<><span className="truncate max-w-[100px]">{hierarchy.macro.name}</span><ChevronRight size={10} /></>)}
          {hierarchy.parent && (<><span className="truncate max-w-[100px]">{hierarchy.parent.name}</span><ChevronRight size={10} /></>)}
          <span className="text-white font-semibold truncate max-w-[200px]">{process.name}</span>
          <ChevronRight size={10} />
          <span className="text-amber-400 font-semibold">Indicadores KPI</span>
        </div>

        <div className="flex-1" />

        {/* Quick nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/app/process/${processId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
          >
            <Settings2 size={13} /> Ficha
          </button>
          <button
            onClick={() => navigate(`/app/process/${processId}/characterization`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
          >
            <GitBranch size={13} /> Diagramador
          </button>
          <button
            onClick={() => navigate(`/app/process/${processId}/procedure`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
          >
            <Book size={13} /> Procedimiento
          </button>
        </div>
      </div>

      {/* ═══ INDICATORS AREA ═══ */}
      <div className="flex-1 overflow-y-auto bg-[#0d1420]">
        <div className="max-w-5xl mx-auto py-6 px-6">
          <ErrorBoundary>
            <IndicatorsTab
              processId={processId!}
              processName={process.name}
              description={process.description || ''}
              bpmnXml={process.bpmn_xml || ''}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
