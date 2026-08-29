import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, GitBranch, Settings2, BarChart3 } from 'lucide-react'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { ProcedureTab } from '@/features/procedure/components/ProcedureTab'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'
import { processMapUrl } from '@/lib/processMapUrl'

export default function ProcedurePage() {
  const { processId } = useParams<{ processId: string }>()
  const navigate = useNavigate()

  // Solo se documenta en el nivel más bajo declarado — ver @/lib/processLevels.
  useDocumentableGuard(processId)

  const processes = useProcessStore((s) => s.processes)
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const company = useCompanyStore((s) => s.company)
  const getSipocByProcess = useCatalogStore((s) => s.getSipocByProcess)

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

  const processSipoc = processId ? getSipocByProcess(processId) : []

  if (!process) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-lg">Proceso no encontrado</p>
        <button onClick={() => navigate(processMapUrl(process))} className="mt-4 text-primary-600 hover:underline">Volver al mapa</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 lg:-m-6 bg-surface-ground">
      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100 shrink-0 overflow-x-auto">
        {/* Back */}
        <button
          onClick={() => navigate(`/app/process/${processId}`)}
          className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-3">
          {hierarchy.macro && (<><span className="truncate max-w-[100px]">{hierarchy.macro.name}</span><ChevronRight size={10} /></>)}
          {hierarchy.parent && (<><span className="truncate max-w-[100px]">{hierarchy.parent.name}</span><ChevronRight size={10} /></>)}
          <span className="text-gray-900 font-semibold truncate max-w-[200px]">{process.name}</span>
          <ChevronRight size={10} />
          <span className="text-primary-600 font-semibold">Procedimiento</span>
        </div>

        <div className="flex-1" />

        {/* Quick nav */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/app/process/${processId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all"
          >
            <Settings2 size={13} /> Ficha
          </button>
          <button
            onClick={() => navigate(`/app/process/${processId}/characterization`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all"
          >
            <GitBranch size={13} /> Diagramador
          </button>
          <button
            onClick={() => navigate(`/app/process/${processId}/indicators`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-all"
          >
            <BarChart3 size={13} /> KPIs
          </button>
        </div>
      </div>

      {/* ═══ DOCUMENT AREA ═══ */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto py-6 px-4">
          <ErrorBoundary>
            <ProcedureTab
              processId={processId!}
              companyName={company?.name || ''}
              industry={company?.industry}
              macroprocessName={hierarchy.macro?.name || ''}
              parentProcessName={hierarchy.parent?.name}
              processName={process.name}
              description={process.description}
              sipocEntries={processSipoc}
              bpmnXml={process.bpmn_xml || undefined}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
