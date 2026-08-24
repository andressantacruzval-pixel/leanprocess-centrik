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
  { key: 'procedimiento', label: 'Procedimiento', hint: 'SOP del proceso', title: 'Procedimiento', Icon: Book, iconBg: 'bg-purple-500/10', iconText: 'text-purple-400', hover: 'hover:border-purple-500/30 hover:bg-purple-500/[0.03]' },
  { key: 'indicadores', label: 'KPI', hint: 'Métricas y semáforos', title: 'Indicadores KPI', Icon: BarChart3, iconBg: 'bg-amber-500/10', iconText: 'text-amber-400', hover: 'hover:border-amber-500/30 hover:bg-amber-500/[0.03]' },
  { key: 'riesgos', label: 'Riesgos', hint: 'Matriz 5×5 y controles', title: 'Gestión de Riesgos', Icon: ShieldAlert, iconBg: 'bg-red-500/10', iconText: 'text-red-400', hover: 'hover:border-red-500/30 hover:bg-red-500/[0.03]' },
  { key: 'auditoria', label: 'Auditoría', hint: 'Programa de auditoría', title: 'Programa de Auditoría', Icon: ClipboardCheck, iconBg: 'bg-violet-500/10', iconText: 'text-violet-400', hover: 'hover:border-violet-500/30 hover:bg-violet-500/[0.03]' },
  { key: 'analisis', label: 'Valor', hint: 'VA / NVA / NVABN', title: 'Análisis de Valor', Icon: Activity, iconBg: 'bg-teal-500/10', iconText: 'text-teal-400', hover: 'hover:border-teal-500/30 hover:bg-teal-500/[0.03]' },
  { key: 'mejoras', label: 'Mejoras', hint: 'Oportunidades de mejora', title: 'Oportunidades de Mejora', Icon: Lightbulb, iconBg: 'bg-yellow-500/10', iconText: 'text-yellow-400', hover: 'hover:border-yellow-500/30 hover:bg-yellow-500/[0.03]' },
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
    <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">Módulos del proceso</h2>
        <p className="text-[11px] text-white/35">Abre cualquiera sin ir al diagramador. Es la misma información y se guarda en el mismo lugar.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {MODULES.map(({ key, label, hint, Icon, iconBg, iconText, hover }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            title={hint}
            className={`group bg-white/[0.03] rounded-xl border border-white/5 p-3 text-left transition-all ${hover}`}
          >
            <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-2`}>
              <Icon size={17} className={iconText} />
            </div>
            <h3 className="font-semibold text-[12.5px] text-white leading-tight">{label}</h3>
            <p className="text-[10px] text-white/30 mt-0.5 leading-tight">{hint}</p>
          </button>
        ))}
      </div>

      {/* Ventana emergente con el panel seleccionado (mismo componente del diagramador) */}
      {active && activeMod && createPortal(
        <>
          <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActive(null)} />
          <div className="fixed z-[61] inset-0 m-auto h-[90vh] w-[95vw] max-w-4xl bg-[#0a0f1a] rounded-2xl border border-white/10 flex flex-col shadow-[0_8px_60px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg ${activeMod.iconBg} flex items-center justify-center shrink-0`}>
                  <activeMod.Icon size={15} className={activeMod.iconText} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{activeMod.title}</h3>
                  <p className="text-[10px] text-white/35 truncate">{process.name}</p>
                </div>
              </div>
              <button onClick={() => setActive(null)} title="Cerrar" className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors shrink-0">
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
