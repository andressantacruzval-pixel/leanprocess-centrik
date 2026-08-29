import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Book, BarChart3, ShieldAlert, ClipboardCheck, Activity, Lightbulb, X } from 'lucide-react'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { ProcedureTab } from '@/features/procedure/components/ProcedureTab'
import { IndicatorsTab } from '@/features/kpi/components/IndicatorsTab'
import { RiskPanel } from '@/features/risk/components/RiskPanel'
import { AuditTab } from '@/features/audit/components/AuditTab'
import { ValueAnalysisTab } from '@/features/value-analysis/components/ValueAnalysisTab'
import { ImprovementTab } from '@/features/improvement/components/ImprovementTab'

// Los MISMOS paneles del rail derecho del diagramador, accesibles como ventanas
// emergentes desde la ficha de caracterización. Es la misma data (mismos stores),
// integrada bidireccionalmente: editar aquí es editar allá. Solo otro punto de acceso.

type ModuleKey = 'procedimiento' | 'indicadores' | 'riesgos' | 'auditoria' | 'analisis' | 'mejoras'

const MODULES: {
  key: ModuleKey
  label: string
  hint: string
  title: string
  Icon: typeof Book
  iconBg: string
  iconText: string
  hover: string
}[] = [
  { key: 'procedimiento', label: 'Procedimiento', hint: 'SOP del proceso', title: 'Procedimiento', Icon: Book, iconBg: 'bg-primary-50', iconText: 'text-primary-600', hover: 'hover:border-primary-300 hover:bg-primary-50' },
  { key: 'indicadores', label: 'KPI', hint: 'Métricas y semáforos', title: 'Indicadores KPI', Icon: BarChart3, iconBg: 'bg-amber-50', iconText: 'text-amber-600', hover: 'hover:border-amber-300 hover:bg-amber-50' },
  { key: 'riesgos', label: 'Riesgos', hint: 'Matriz 5×5 y controles', title: 'Gestión de Riesgos', Icon: ShieldAlert, iconBg: 'bg-red-50', iconText: 'text-red-600', hover: 'hover:border-red-300 hover:bg-red-50' },
  { key: 'auditoria', label: 'Auditoría', hint: 'Programa de auditoría', title: 'Programa de Auditoría', Icon: ClipboardCheck, iconBg: 'bg-primary-50', iconText: 'text-primary-600', hover: 'hover:border-primary-300 hover:bg-primary-50' },
  { key: 'analisis', label: 'Valor', hint: 'VA / NVA / NVABN', title: 'Análisis de Valor', Icon: Activity, iconBg: 'bg-primary-50', iconText: 'text-primary-600', hover: 'hover:border-primary-300 hover:bg-primary-50' },
  { key: 'mejoras', label: 'Mejoras', hint: 'Oportunidades de mejora', title: 'Oportunidades de Mejora', Icon: Lightbulb, iconBg: 'bg-amber-50', iconText: 'text-amber-600', hover: 'hover:border-amber-300 hover:bg-amber-50' },
]

export function ProcessModulesLauncher({ processId }: { processId: string }) {
  const [active, setActive] = useState<ModuleKey | null>(null)

  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const allProcesses = useProcessStore((s) => s.processes)
  const company = useCompanyStore((s) => s.company)
  const getSipocByProcess = useCatalogStore((s) => s.getSipocByProcess)

  if (!process) return null

  const macro = macroprocesses.find((m) => m.id === process.macroprocess_id)
  const parent = process.parent_process_id ? allProcesses.find((p) => p.id === process.parent_process_id) : undefined
  const bpmnXml = process.bpmn_xml || ''
  const description = process.description || undefined
  const sipocEntries = getSipocByProcess(processId)
  const activeMod = MODULES.find((m) => m.key === active)

  const renderPanel = (key: ModuleKey) => {
    switch (key) {
      case 'procedimiento':
        return (
          <ProcedureTab
            processId={processId}
            companyName={company?.name || ''}
            industry={company?.industry}
            macroprocessName={macro?.name || ''}
            parentProcessName={parent?.name}
            processName={process.name}
            description={description}
            sipocEntries={sipocEntries}
            bpmnXml={bpmnXml || undefined}
            isExpanded
          />
        )
      case 'indicadores':
        return <IndicatorsTab processId={processId} processName={process.name} description={description} bpmnXml={bpmnXml} isExpanded />
      case 'riesgos':
        return <RiskPanel processId={processId} processName={process.name} bpmnXml={bpmnXml || undefined} isExpanded />
      case 'auditoria':
        return <AuditTab processId={processId} processName={process.name} bpmnXml={bpmnXml || undefined} isExpanded />
      case 'analisis':
        return <ValueAnalysisTab processId={processId} processName={process.name} bpmnXml={bpmnXml || undefined} isExpanded />
      case 'mejoras':
        return <ImprovementTab processId={processId} processName={process.name} bpmnXml={bpmnXml || undefined} isExpanded />
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">Módulos del proceso</h2>
        <p className="text-[11px] text-gray-400">Abre cualquiera sin ir al diagramador. Es la misma información y se guarda en el mismo lugar.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {MODULES.map(({ key, label, hint, Icon, iconBg, iconText, hover }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            title={hint}
            className={`group bg-gray-50 rounded-lg border border-gray-100 p-3 text-left transition-all ${hover}`}
          >
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-2`}>
              <Icon size={17} className={iconText} />
            </div>
            <h3 className="font-semibold text-[12.5px] text-gray-900 leading-tight">{label}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{hint}</p>
          </button>
        ))}
      </div>

      {/* Ventana emergente con el panel seleccionado (mismo componente del diagramador) */}
      {active && activeMod && createPortal(
        <>
          <div className="fixed inset-0 z-[60] bg-gray-900/45 animate-in fade-in duration-200" onClick={() => setActive(null)} />
          <div className="fixed z-[61] inset-0 m-auto h-[90vh] w-[95vw] max-w-4xl bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-900/45 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg ${activeMod.iconBg} flex items-center justify-center shrink-0`}>
                  <activeMod.Icon size={15} className={activeMod.iconText} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{activeMod.title}</h3>
                  <p className="text-[10px] text-gray-400 truncate">{process.name}</p>
                </div>
              </div>
              <button onClick={() => setActive(null)} title="Cerrar" className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ErrorBoundary>{renderPanel(active)}</ErrorBoundary>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
