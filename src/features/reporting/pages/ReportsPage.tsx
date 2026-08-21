import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText, ShieldAlert, TrendingUp, Activity, ClipboardCheck,
  Download, Search, X, BarChart3, Lightbulb, LayoutGrid, List, UserCog, IdCard,
} from 'lucide-react'
import { InventoryReport as InventoryReportUnified } from '@/features/inventory/components/InventoryReport'
import { CargosReport } from '../reports/CargosReport'
import { CargoManualsReport } from '../reports/CargoManualsReport'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { useCompanyStore } from '@/stores/companyStore'
import { useAuthStore } from '@/stores/authStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { exportReportToExcel, exportReportToPdf } from '@/utils/reportExporter'
import { useImprovementStore } from '@/stores/improvementStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { CARGO_CATALOG } from '@/features/cargos/cargoData'
import { ImprovementsKanban } from '@/features/improvement/components/ImprovementsKanban'
import { RisksReport } from '../reports/RisksReport'
import { KpisReport } from '../reports/KpisReport'
import { ValueReport } from '../reports/ValueReport'
import { AuditReport } from '../reports/AuditReport'
import { ImprovementsReport } from '../reports/ImprovementsReport'

type ReportTab = 'inventario' | 'riesgos' | 'kpis' | 'valor' | 'auditoria' | 'mejoras' | 'cargos' | 'manuales'

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: 'inventario', label: 'Inventario', icon: FileText },
  { key: 'riesgos', label: 'Riesgos', icon: ShieldAlert },
  { key: 'kpis', label: 'KPIs', icon: TrendingUp },
  { key: 'valor', label: 'Valor', icon: Activity },
  { key: 'auditoria', label: 'Auditoria', icon: ClipboardCheck },
  { key: 'mejoras', label: 'Mejoras', icon: Lightbulb },
  { key: 'cargos', label: 'Cargos', icon: UserCog },
  { key: 'manuales', label: 'Manuales de Cargo', icon: IdCard },
]

// Reportes que se pintan a ancho completo (componente propio, sin la barra de
// filtros por proceso): tienen sus propios filtros internos.
const STANDALONE: ReportTab[] = ['inventario', 'cargos', 'manuales']

const isTab = (v: string | null): v is ReportTab => !!v && TABS.some((t) => t.key === v)

export default function ReportsPage() {
  const [searchParams] = useSearchParams()
  const initialTab = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as ReportTab) : 'inventario'
  const [activeTab, setActiveTab] = useState<ReportTab>(initialTab)
  const [search, setSearch] = useState('')
  const [filterManagement, setFilterManagement] = useState<string>('')
  const [filterArea, setFilterArea] = useState<string>('')
  const [filterMacro, setFilterMacro] = useState<string>('')
  const [filterLevel, setFilterLevel] = useState<string>('')
  const [mejorasView, setMejorasView] = useState<'tabla' | 'kanban'>('tabla')

  const company = useCompanyStore((s) => s.company)
  const profile = useAuthStore((s) => s.profile)
  const levelDefinitions = useProcessStore((s) => s.levelDefinitions)
  const {
    macroprocesses, processes,
    risks: allRisks, indicators: allIndicators,
    procedures: allProcedures, audits: allAudits, analyses: allAnalyses,
    improvements: allImprovements,
  } = useCompanyScopedData()
  const updateOpportunity = useImprovementStore((s) => s.updateOpportunity)
  const deleteOpportunity = useImprovementStore((s) => s.deleteOpportunity)
  const catalogItems = useCatalogStore((s) => s.catalogItems)
  const cargoCatalog = useMemo(() => catalogItems.filter((c) => c.catalog_type === CARGO_CATALOG && c.is_active).map((c) => c.value), [catalogItems])

  const macroMap = useMemo(() => new Map(macroprocesses.map((m) => [m.id, m])), [macroprocesses])
  const processMap = useMemo(() => new Map(processes.map((p) => [p.id, p])), [processes])
  const levelMap = useMemo(() => new Map(levelDefinitions.map((l) => [l.id, l.level_name])), [levelDefinitions])

  const managements = useMemo(() => [...new Set(processes.map((p) => p.management).filter(Boolean))].sort() as string[], [processes])
  const areas = useMemo(() => [...new Set(processes.map((p) => p.coordination).filter(Boolean))].sort() as string[], [processes])
  const macroNames = useMemo(() => macroprocesses.map((m) => ({ id: m.id, name: m.name })), [macroprocesses])
  const levels = useMemo(
    () => [...new Set(processes.map((p) => (p.level_definition_id ? levelMap.get(p.level_definition_id) : null)).filter(Boolean))].sort() as string[],
    [processes, levelMap]
  )

  const filteredProcesses = useMemo(() => {
    let result = processes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.management?.toLowerCase().includes(q) || p.coordination?.toLowerCase().includes(q))
    }
    if (filterManagement) result = result.filter((p) => p.management === filterManagement)
    if (filterArea) result = result.filter((p) => p.coordination === filterArea)
    if (filterMacro) result = result.filter((p) => p.macroprocess_id === filterMacro)
    if (filterLevel) result = result.filter((p) => (p.level_definition_id ? levelMap.get(p.level_definition_id) : null) === filterLevel)
    return result
  }, [processes, search, filterManagement, filterArea, filterMacro, filterLevel, levelMap])

  const handleExport = useCallback((format: 'pdf' | 'excel') => {
    const data = {
      tab: activeTab, company, generatedBy: profile?.full_name ?? null,
      processes: filteredProcesses, macroMap, processMap,
      allRisks, allIndicators, allProcedures, allAudits, allAnalyses, allImprovements, cargoCatalog,
    }
    if (format === 'excel') exportReportToExcel(data)
    else exportReportToPdf(data)
  }, [activeTab, company, profile, filteredProcesses, macroMap, processMap, allRisks, allIndicators, allProcedures, allAudits, allAnalyses, allImprovements, cargoCatalog])

  const hasFilters = search || filterManagement || filterArea || filterMacro || filterLevel

  const filteredImprovements = useMemo(() => {
    const ids = new Set(filteredProcesses.map((p) => p.id))
    return allImprovements.filter((o) => ids.has(o.processId))
  }, [filteredProcesses, allImprovements])
  const processNameById = useMemo(() => new Map(processes.map((p) => [p.id, p.name])), [processes])

  const fInput = 'appearance-none bg-white/[0.03] border border-white/5 rounded-lg pl-2 pr-6 py-1.5 text-[11px] text-white/60 outline-none cursor-pointer'

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Reportes"
        subtitle="Analiza, filtra y exporta la informacion de tus procesos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleExport('excel')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors ring-1 ring-emerald-500/20">
              <Download size={13} /> Excel
            </button>
            <button onClick={() => handleExport('pdf')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ring-1 ring-red-500/20">
              <Download size={13} /> PDF
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/5 overflow-x-auto">
        {TABS.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${activeTab === tab.key ? 'bg-cyan-500/15 text-cyan-400 shadow-sm' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {STANDALONE.includes(activeTab) ? (
        <div className="bg-white/[0.02] rounded-2xl border border-white/5">
          {activeTab === 'inventario' && <InventoryReportUnified />}
          {activeTab === 'cargos' && <CargosReport />}
          {activeTab === 'manuales' && <CargoManualsReport />}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg border border-white/5 px-3 py-1.5 flex-1 max-w-[200px]">
              <Search size={13} className="text-white/20 shrink-0" />
              <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-white/20 outline-none flex-1 min-w-0" />
              {search && <button onClick={() => setSearch('')} className="text-white/20 hover:text-white/50"><X size={12} /></button>}
            </div>

            <SelectFilter value={filterMacro} onChange={setFilterMacro} options={macroNames.map((m) => ({ value: m.id, label: m.name }))} placeholder="Macroproceso" className={fInput} />
            <SelectFilter value={filterManagement} onChange={setFilterManagement} options={managements.map((m) => ({ value: m, label: m }))} placeholder="Gerencia" className={fInput} />
            <SelectFilter value={filterArea} onChange={setFilterArea} options={areas.map((a) => ({ value: a, label: a }))} placeholder="Area" className={fInput} />
            <SelectFilter value={filterLevel} onChange={setFilterLevel} options={levels.map((l) => ({ value: l, label: l }))} placeholder="Nivel" className={fInput} />

            {hasFilters && (
              <button onClick={() => { setSearch(''); setFilterManagement(''); setFilterArea(''); setFilterMacro(''); setFilterLevel('') }}
                className="text-[10px] text-white/30 hover:text-white/50 transition-colors">Limpiar</button>
            )}

            {activeTab === 'mejoras' && (
              <div className="flex items-center gap-0.5 ml-auto rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                <button onClick={() => setMejorasView('tabla')} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${mejorasView === 'tabla' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white/70'}`}>
                  <List size={12} /> Tabla
                </button>
                <button onClick={() => setMejorasView('kanban')} className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${mejorasView === 'kanban' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white/70'}`}>
                  <LayoutGrid size={12} /> Vista Kanban
                </button>
              </div>
            )}

            <span className={`text-[10px] text-white/20 shrink-0 ${activeTab === 'mejoras' ? '' : 'ml-auto'}`}>{filteredProcesses.length} de {processes.length}</span>
          </div>

          {/* Report Content */}
          {processes.length === 0 ? (
            <div className="bg-white/[0.02] rounded-2xl border border-white/5">
              <EmptyState
                icon={BarChart3}
                title="Genera datos para tus reportes"
                description="Crea procesos, identifica riesgos y define KPIs para visualizar reportes completos"
                actionLabel="Crear procesos"
                actionHref="/app/process-map"
              />
            </div>
          ) : (
            <div className="bg-white/[0.02] rounded-2xl border border-white/5">
              {activeTab === 'riesgos' && <RisksReport processes={filteredProcesses} allRisks={allRisks} />}
              {activeTab === 'kpis' && <KpisReport processes={filteredProcesses} allIndicators={allIndicators} />}
              {activeTab === 'valor' && <ValueReport processes={filteredProcesses} allAnalyses={allAnalyses} />}
              {activeTab === 'auditoria' && <AuditReport processes={filteredProcesses} allAudits={allAudits} />}
              {activeTab === 'mejoras' && mejorasView === 'tabla' && <ImprovementsReport processes={filteredProcesses} allImprovements={allImprovements} onUpdate={updateOpportunity} />}
              {activeTab === 'mejoras' && mejorasView === 'kanban' && (
                <div className="p-3">
                  <ImprovementsKanban opportunities={filteredImprovements} processNameById={processNameById} onUpdate={updateOpportunity} onDelete={deleteOpportunity} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
