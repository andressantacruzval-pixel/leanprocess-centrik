import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileText, ShieldAlert, TrendingUp, Activity, ClipboardCheck,
  Download, Search, X, BarChart3, Lightbulb, LayoutGrid, List, Map as MapIcon,
} from 'lucide-react'
import { InventoryDashboard } from '@/features/inventory/components/InventoryDashboard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { useCompanyStore } from '@/stores/companyStore'
import { useAuthStore } from '@/stores/authStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { getRiskLevel, type RiskItem } from '@/types/risk'
import { CLASSIFICATION_COLORS, scaleToPeriod, type ValueActivity } from '@/utils/valueAnalysis'
import { exportReportToExcel, exportReportToPdf } from '@/utils/reportExporter'
import type { Macroprocess, Process } from '@/types/process'
import type { StoredIndicator } from '@/stores/indicatorStore'
import type { StoredProcedure } from '@/stores/procedureStore'
import type { AuditItem } from '@/lib/procedureAi'
import { useImprovementStore } from '@/stores/improvementStore'
import {
  type ImprovementOpportunity, type ImprovementStatus,
  STATUS_LABELS, STATUS_OPTIONS, priorityScore, priorityLabel,
} from '@/types/improvement'
import { ImprovementsKanban } from '@/features/improvement/components/ImprovementsKanban'

type ReportTab = 'inventario' | 'inventario-ia' | 'riesgos' | 'kpis' | 'valor' | 'auditoria' | 'mejoras'

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: 'inventario', label: 'Inventario', icon: FileText },
  { key: 'inventario-ia', label: 'Inventario IA', icon: MapIcon },
  { key: 'riesgos', label: 'Riesgos', icon: ShieldAlert },
  { key: 'kpis', label: 'KPIs', icon: TrendingUp },
  { key: 'valor', label: 'Valor', icon: Activity },
  { key: 'auditoria', label: 'Auditoria', icon: ClipboardCheck },
  { key: 'mejoras', label: 'Mejoras', icon: Lightbulb },
]

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
  const levelDefinitions = useProcessStore(s => s.levelDefinitions)
  const {
    macroprocesses, processes,
    risks: allRisks, indicators: allIndicators,
    procedures: allProcedures, audits: allAudits, analyses: allAnalyses,
    improvements: allImprovements,
  } = useCompanyScopedData()
  const updateOpportunity = useImprovementStore((s) => s.updateOpportunity)
  const deleteOpportunity = useImprovementStore((s) => s.deleteOpportunity)

  const macroMap = useMemo(() => new Map(macroprocesses.map(m => [m.id, m])), [macroprocesses])
  const processMap = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes])
  const levelMap = useMemo(() => new Map(levelDefinitions.map(l => [l.id, l.level_name])), [levelDefinitions])

  const managements = useMemo(() => [...new Set(processes.map(p => p.management).filter(Boolean))].sort() as string[], [processes])
  const areas = useMemo(() => [...new Set(processes.map(p => p.coordination).filter(Boolean))].sort() as string[], [processes])
  const macroNames = useMemo(() => macroprocesses.map(m => ({ id: m.id, name: m.name })), [macroprocesses])
  const levels = useMemo(
    () => [...new Set(processes.map(p => p.level_definition_id ? levelMap.get(p.level_definition_id) : null).filter(Boolean))].sort() as string[],
    [processes, levelMap]
  )

  const filteredProcesses = useMemo(() => {
    let result = processes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.management?.toLowerCase().includes(q) || p.coordination?.toLowerCase().includes(q))
    }
    if (filterManagement) result = result.filter(p => p.management === filterManagement)
    if (filterArea) result = result.filter(p => p.coordination === filterArea)
    if (filterMacro) result = result.filter(p => p.macroprocess_id === filterMacro)
    if (filterLevel) result = result.filter(p => (p.level_definition_id ? levelMap.get(p.level_definition_id) : null) === filterLevel)
    return result
  }, [processes, search, filterManagement, filterArea, filterMacro, filterLevel, levelMap])

  const handleExport = useCallback((format: 'pdf' | 'excel') => {
    const data = {
      tab: activeTab, company, generatedBy: profile?.full_name ?? null,
      processes: filteredProcesses, macroMap, processMap,
      allRisks, allIndicators, allProcedures, allAudits, allAnalyses,
    }
    if (format === 'excel') exportReportToExcel(data)
    else exportReportToPdf(data)
  }, [activeTab, company, profile, filteredProcesses, macroMap, processMap, allRisks, allIndicators, allProcedures, allAudits, allAnalyses])

  const hasFilters = search || filterManagement || filterArea || filterMacro || filterLevel

  const filteredImprovements = useMemo(() => {
    const ids = new Set(filteredProcesses.map((p) => p.id))
    return allImprovements.filter((o) => ids.has(o.processId))
  }, [filteredProcesses, allImprovements])
  const processNameById = useMemo(() => new Map(processes.map((p) => [p.id, p.name])), [processes])

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title="Reportes"
        subtitle="Exporta y analiza la informacion de tus procesos"
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

      {activeTab === 'inventario-ia' ? (
        <InventoryDashboard />
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

        <SelectFilter
          value={filterMacro}
          onChange={setFilterMacro}
          options={macroNames.map((m) => ({ value: m.id, label: m.name }))}
          placeholder="Macroproceso"
          className="appearance-none bg-white/[0.03] border border-white/5 rounded-lg pl-2 pr-6 py-1.5 text-[11px] text-white/60 outline-none cursor-pointer"
        />

        <SelectFilter
          value={filterManagement}
          onChange={setFilterManagement}
          options={managements.map((m) => ({ value: m, label: m }))}
          placeholder="Gerencia"
          className="appearance-none bg-white/[0.03] border border-white/5 rounded-lg pl-2 pr-6 py-1.5 text-[11px] text-white/60 outline-none cursor-pointer"
        />

        <SelectFilter
          value={filterArea}
          onChange={setFilterArea}
          options={areas.map((a) => ({ value: a, label: a }))}
          placeholder="Area"
          className="appearance-none bg-white/[0.03] border border-white/5 rounded-lg pl-2 pr-6 py-1.5 text-[11px] text-white/60 outline-none cursor-pointer"
        />

        <SelectFilter
          value={filterLevel}
          onChange={setFilterLevel}
          options={levels.map((l) => ({ value: l, label: l }))}
          placeholder="Nivel"
          className="appearance-none bg-white/[0.03] border border-white/5 rounded-lg pl-2 pr-6 py-1.5 text-[11px] text-white/60 outline-none cursor-pointer"
        />

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterManagement(''); setFilterArea(''); setFilterMacro(''); setFilterLevel('') }}
            className="text-[10px] text-white/30 hover:text-white/50 transition-colors">Limpiar</button>
        )}

        {activeTab === 'mejoras' && (
          <div className="flex items-center gap-0.5 ml-auto rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <button
              onClick={() => setMejorasView('tabla')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${mejorasView === 'tabla' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white/70'}`}
            >
              <List size={12} /> Tabla
            </button>
            <button
              onClick={() => setMejorasView('kanban')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${mejorasView === 'kanban' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white/70'}`}
            >
              <LayoutGrid size={12} /> Vista Kanban
            </button>
          </div>
        )}

        <span className={`text-[10px] text-white/20 shrink-0 ${activeTab === 'mejoras' ? '' : 'ml-auto'}`}>{filteredProcesses.length} de {processes.length}</span>
      </div>

      {/* Report Content — scrollbar visible */}
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
        <div className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {activeTab === 'inventario' && <InventoryReport processes={filteredProcesses} macroMap={macroMap} allProcedures={allProcedures} levelMap={levelMap} />}
          {activeTab === 'riesgos' && <RisksReport processes={filteredProcesses} macroMap={macroMap} allRisks={allRisks} />}
          {activeTab === 'kpis' && <KpisReport processes={filteredProcesses} macroMap={macroMap} allIndicators={allIndicators} />}
          {activeTab === 'valor' && <ValueReport processes={filteredProcesses} macroMap={macroMap} allAnalyses={allAnalyses} />}
          {activeTab === 'auditoria' && <AuditReport processes={filteredProcesses} macroMap={macroMap} allAudits={allAudits} />}
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

// ═══════════════════════════════════════════════════════════════════════
// INVENTORY REPORT
// ═══════════════════════════════════════════════════════════════════════

function InventoryReport({ processes, macroMap, allProcedures, levelMap }: {
  processes: Process[]
  macroMap: Map<string, Macroprocess>
  allProcedures: StoredProcedure[]
  levelMap: Map<string, string>
}) {
  const procedureSet = useMemo(() => new Set(allProcedures.map(p => p.process_id)), [allProcedures])
  const { visibles, ocultas, verMas } = useVerMas(processes)

  return (
    <table className="w-full text-left min-w-[1200px]">
      <thead>
        <tr className="bg-white/[0.03] border-b border-white/5">
          <Th>Gerencia</Th><Th>Area</Th><Th>Nivel</Th><Th>Macroproceso</Th><Th>Subproceso</Th>
          <Th>Responsable</Th><Th>Tipo</Th><Th>Frecuencia</Th><Th>Critico</Th><Th>BPMN</Th><Th>Procedimiento</Th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((p) => {
          const macro = macroMap.get(p.macroprocess_id)
          return (
            <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <Td>{p.management || '-'}</Td>
              <Td>{p.coordination || '-'}</Td>
              <Td>{p.level_definition_id ? (levelMap.get(p.level_definition_id) ?? '-') : '-'}</Td>
              <Td>{macro?.name || '-'}</Td>
              <Td className="text-white font-medium">{p.name}</Td>
              <Td>{p.responsible || '-'}</Td>
              <Td>{p.process_type || '-'}</Td>
              <Td>{p.execution_frequency || '-'}</Td>
              <Td>{p.is_critical ? <Badge label="Si" color="red" /> : <Badge label="No" color="gray" />}</Td>
              <Td>{p.bpmn_xml ? <Badge label="Si" color="emerald" /> : <Badge label="No" color="gray" />}</Td>
              <Td>{procedureSet.has(p.id) ? <Badge label="Si" color="emerald" /> : <Badge label="No" color="gray" />}</Td>
            </tr>
          )
        })}
        {processes.length === 0 && <EmptyRow cols={11} />}
        <VerMasRow cols={11} ocultas={ocultas} onVerMas={verMas} />
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// RISKS REPORT
// ═══════════════════════════════════════════════════════════════════════

function RisksReport({ processes, allRisks }: { processes: Process[]; macroMap?: Map<string, Macroprocess>; allRisks: RiskItem[] }) {
  const processIds = useMemo(() => new Set(processes.map(p => p.id)), [processes])
  const processMap = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes])
  const filteredRisks = useMemo(() => allRisks.filter(r => processIds.has(r.process_id)), [allRisks, processIds])

  const { visibles, ocultas, verMas } = useVerMas(filteredRisks)

  return (
    <table className="w-full text-left min-w-[1200px]">
      <thead>
        <tr className="bg-white/[0.03] border-b border-white/5">
          <Th>Gerencia</Th><Th>Area</Th><Th>Proceso</Th><Th>Riesgo</Th><Th>Categoria</Th>
          <Th>Actividad</Th><Th>P.I</Th><Th>I.I</Th><Th>Nivel Inh.</Th>
          <Th>Controles</Th><Th>P.R</Th><Th>I.R</Th><Th>Nivel Res.</Th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((r) => {
          const proc = processMap.get(r.process_id)
          const inhLevel = getRiskLevel(r.inherentProbability, r.inherentImpact)
          const resLevel = getRiskLevel(r.residualProbability, r.residualImpact)
          return (
            <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <Td>{proc?.management || '-'}</Td>
              <Td>{proc?.coordination || '-'}</Td>
              <Td>{proc?.name || '-'}</Td>
              <Td className="text-white font-medium max-w-[200px]"><div className="truncate">{r.title}</div></Td>
              <Td>{r.category}</Td>
              <Td className="max-w-[120px]"><div className="truncate">{r.processStep || '-'}</div></Td>
              <Td>{r.inherentProbability}</Td>
              <Td>{r.inherentImpact}</Td>
              <Td><RiskBadge label={inhLevel.label} hex={inhLevel.hex} /></Td>
              <Td>{r.controls.length}</Td>
              <Td>{r.residualProbability}</Td>
              <Td>{r.residualImpact}</Td>
              <Td><RiskBadge label={resLevel.label} hex={resLevel.hex} /></Td>
            </tr>
          )
        })}
        {filteredRisks.length === 0 && <EmptyRow cols={13} />}
        <VerMasRow cols={13} ocultas={ocultas} onVerMas={verMas} />
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// KPIs REPORT
// ═══════════════════════════════════════════════════════════════════════

function KpisReport({ processes, allIndicators }: { processes: Process[]; macroMap?: Map<string, Macroprocess>; allIndicators: StoredIndicator[] }) {
  const processIds = useMemo(() => new Set(processes.map(p => p.id)), [processes])
  const processMap = useMemo(() => new Map(processes.map(p => [p.id, p])), [processes])
  const filtered = useMemo(() => allIndicators.filter(i => processIds.has(i.process_id)), [allIndicators, processIds])

  const { visibles, ocultas, verMas } = useVerMas(filtered)

  return (
    <table className="w-full text-left min-w-[1200px]">
      <thead>
        <tr className="bg-white/[0.03] border-b border-white/5">
          <Th>Gerencia</Th><Th>Area</Th><Th>Proceso</Th><Th>Indicador</Th><Th>Objetivo</Th>
          <Th>Formula</Th><Th>Unidad</Th><Th>Frecuencia</Th><Th>Meta</Th><Th>Resp. Reporte</Th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((i) => {
          const proc = processMap.get(i.process_id)
          return (
            <tr key={i.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <Td>{proc?.management || '-'}</Td>
              <Td>{proc?.coordination || '-'}</Td>
              <Td>{proc?.name || '-'}</Td>
              <Td className="text-white font-medium">{i.name}</Td>
              <Td className="max-w-[200px]"><div className="truncate">{i.description}</div></Td>
              <Td className="max-w-[150px]"><div className="truncate">{i.formula}</div></Td>
              <Td>{i.unit}</Td>
              <Td>{i.frequency}</Td>
              <Td>{i.target_value}</Td>
              <Td>{i.owner}</Td>
            </tr>
          )
        })}
        {filtered.length === 0 && <EmptyRow cols={10} />}
        <VerMasRow cols={10} ocultas={ocultas} onVerMas={verMas} />
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// VALUE ANALYSIS REPORT
// ═══════════════════════════════════════════════════════════════════════

function ValueReport({ processes, allAnalyses }: { processes: Process[]; macroMap?: Map<string, Macroprocess>; allAnalyses: Record<string, ValueActivity[]> }) {
  const rows = useMemo(() => {
    const result: { process: Process; activity: ValueActivity }[] = []
    for (const p of processes) {
      for (const a of (allAnalyses[p.id] || [])) result.push({ process: p, activity: a })
    }
    return result
  }, [processes, allAnalyses])

  const { visibles, ocultas, verMas } = useVerMas(rows)

  return (
    <table className="w-full text-left min-w-[1200px]">
      <thead>
        <tr className="bg-white/[0.03] border-b border-white/5">
          <Th>Gerencia</Th><Th>Area</Th><Th>Proceso</Th><Th>Actividad</Th><Th>Responsable</Th>
          <Th>Clasificacion</Th><Th>Frecuencia</Th><Th>Min</Th><Th>Ocurr.</Th><Th>Min/Dia</Th><Th>Min/Mes</Th><Th>Hrs/Ano</Th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((row, i) => {
          const cls = row.activity.classification
          const clsColor = cls ? CLASSIFICATION_COLORS[cls as keyof typeof CLASSIFICATION_COLORS] : null
          return (
            <tr key={`${row.process.id}-${row.activity.id}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <Td>{row.process.management || '-'}</Td>
              <Td>{row.process.coordination || '-'}</Td>
              <Td>{row.process.name}</Td>
              <Td className="text-white font-medium">{row.activity.name}</Td>
              <Td>{row.activity.laneName || '-'}</Td>
              <Td>
                {cls && clsColor ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${clsColor.bg} ${clsColor.text}`}>{cls}</span>
                ) : '-'}
              </Td>
              <Td>{row.activity.frequency || '-'}</Td>
              <Td>{row.activity.timePerOccurrence || '-'}</Td>
              <Td>{row.activity.occurrences || '-'}</Td>
              <Td>{row.activity.dailyMinutes ? Math.round(row.activity.dailyMinutes * 10) / 10 : '-'}</Td>
              <Td>{row.activity.dailyMinutes ? Math.round(scaleToPeriod(row.activity.dailyMinutes, 'mes')) : '-'}</Td>
              <Td>{row.activity.dailyMinutes ? Math.round(scaleToPeriod(row.activity.dailyMinutes, 'año') / 60 * 10) / 10 : '-'}</Td>
            </tr>
          )
        })}
        {rows.length === 0 && <EmptyRow cols={12} />}
        <VerMasRow cols={12} ocultas={ocultas} onVerMas={verMas} />
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT REPORT
// ═══════════════════════════════════════════════════════════════════════

function AuditReport({ processes, allAudits }: { processes: Process[]; macroMap?: Map<string, Macroprocess>; allAudits: Record<string, AuditItem[]> }) {
  const rows = useMemo(() => {
    const result: { process: Process; item: AuditItem }[] = []
    for (const p of processes) {
      for (const item of (allAudits[p.id] || [])) result.push({ process: p, item })
    }
    return result
  }, [processes, allAudits])

  const { visibles, ocultas, verMas } = useVerMas(rows)

  return (
    <table className="w-full text-left min-w-[1100px]">
      <thead>
        <tr className="bg-white/[0.03] border-b border-white/5">
          <Th>Gerencia</Th><Th>Area</Th><Th>Proceso</Th><Th>Actividad</Th>
          <Th>Que Auditar</Th><Th>Criterio</Th><Th>Evidencia</Th><Th>Frecuencia</Th><Th>Responsable</Th>
        </tr>
      </thead>
      <tbody>
        {visibles.map((row, i) => (
          <tr key={`${row.process.id}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
            <Td>{row.process.management || '-'}</Td>
            <Td>{row.process.coordination || '-'}</Td>
            <Td className="max-w-[160px]"><div className="truncate">{row.process.name}</div></Td>
            <Td className="max-w-[220px]"><div className="truncate">{row.item.actividad}</div></Td>
            <Td className="text-white font-medium max-w-[200px]"><div className="truncate">{row.item.queAuditar}</div></Td>
            <Td className="max-w-[180px]"><div className="truncate">{row.item.criterio}</div></Td>
            <Td className="max-w-[150px]"><div className="truncate">{row.item.evidencia}</div></Td>
            <Td>{row.item.frecuencia}</Td>
            <Td>{row.item.responsable}</Td>
          </tr>
        ))}
        {rows.length === 0 && <EmptyRow cols={9} />}
        <VerMasRow cols={9} ocultas={ocultas} onVerMas={verMas} />
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// IMPROVEMENTS REPORT (planes de acción — gestión)
// ═══════════════════════════════════════════════════════════════════════

function ImprovementsReport({
  processes, allImprovements, onUpdate,
}: {
  processes: Process[]
  allImprovements: ImprovementOpportunity[]
  onUpdate: (id: string, updates: Partial<ImprovementOpportunity>) => void
}) {
  const rows = useMemo(() => {
    const byProcess = new Set(processes.map((p) => p.id))
    const pMap = new Map(processes.map((p) => [p.id, p]))
    return allImprovements
      .filter((o) => byProcess.has(o.processId))
      .map((o) => ({ o, process: pMap.get(o.processId)! }))
  }, [processes, allImprovements])

  const { visibles, ocultas, verMas } = useVerMas(rows)
  const inputCls = 'bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40'

  return (
    <table className="w-full text-left min-w-[1300px]">
      <thead>
        <tr className="bg-white/[0.03] border-b border-white/5">
          <Th>Gerencia</Th><Th>Proceso</Th><Th>Oportunidad</Th><Th>Prioridad</Th>
          <Th>Costo</Th><Th>Compl.</Th><Th>Tiempo</Th><Th>Responsable</Th>
          <Th>Inicio</Th><Th>Fin</Th><Th>Estado</Th><Th>Avance</Th><Th>Cierre</Th>
        </tr>
      </thead>
      <tbody>
        {visibles.map(({ o, process }) => {
          const total = priorityScore(o)
          const prio = priorityLabel(total)
          return (
            <tr key={o.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors align-top">
              <Td>{process.management || '-'}</Td>
              <Td className="max-w-[150px]"><div className="truncate">{process.name}</div></Td>
              <Td className="text-white font-medium max-w-[240px]">
                <div className="truncate" title={o.name}>{o.name}</div>
                <div className="text-white/30 text-[10px] truncate max-w-[240px]" title={o.description}>{o.description}</div>
              </Td>
              <Td><span className="text-[10px] font-semibold">{total}/15 · {prio.label}</span></Td>
              <Td>{o.costScore}</Td>
              <Td>{o.complexityScore}</Td>
              <Td>{o.timeScore}</Td>
              <Td className="max-w-[120px]"><div className="truncate">{o.responsible || '-'}</div></Td>
              <Td>{o.startDate || '-'}</Td>
              <Td>{o.endDate || '-'}</Td>
              <Td>
                <select value={o.status} onChange={(e) => onUpdate(o.id, { status: e.target.value as ImprovementStatus })} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-[#0a0f1a]">{STATUS_LABELS[s]}</option>)}
                </select>
              </Td>
              <Td>
                <input
                  type="number" min={0} max={100} step={5} defaultValue={o.progressPct}
                  onBlur={(e) => {
                    const v = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                    if (v !== o.progressPct) onUpdate(o.id, { progressPct: v })
                  }}
                  className={inputCls + ' w-14'}
                />
                <span className="text-white/30 text-[10px]">%</span>
              </Td>
              <Td>
                <input type="date" value={o.closeDate ?? ''} onChange={(e) => onUpdate(o.id, { closeDate: e.target.value || null })} className={inputCls} />
              </Td>
            </tr>
          )
        })}
        {rows.length === 0 && <EmptyRow cols={13} />}
        <VerMasRow cols={13} ocultas={ocultas} onVerMas={verMas} />
      </tbody>
    </table>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Shared table components
// ═══════════════════════════════════════════════════════════════════════

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 text-[9px] font-semibold text-white/30 uppercase tracking-wider whitespace-nowrap sticky top-0 bg-[#0d1117] z-10">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-[11px] text-white/60 whitespace-nowrap ${className}`}>{children}</td>
}

function EmptyRow({ cols }: { cols: number }) {
  return <tr><td colSpan={cols} className="px-3 py-8 text-center text-[11px] text-white/20">No hay datos para mostrar</td></tr>
}

/**
 * Cuantas filas se pintan de golpe en un reporte.
 *
 * Es un tope de RENDERIZADO, no de datos: los reportes leen de memoria, asi que
 * esto no ahorra ni una consulta —la paginacion que si ahorra servidor es la del
 * historial, en `changeLogStore`—. Lo que evita es que una empresa grande pinte
 * cientos de filas de golpe. Hoy la peor tiene 367 en «valor».
 */
const FILAS_POR_TANDA = 100

/**
 * Corta la lista a lo visible y sabe si queda mas.
 *
 * No hace falta reiniciar el contador al filtrar ni al cambiar de pestaña: cada
 * pestaña es un componente distinto que se desmonta, asi que vuelve a 1 solo. Y al
 * filtrar, conservar lo que ya habias desplegado es mejor que replegarlo en la cara.
 */
function useVerMas<T>(rows: T[]) {
  const [tandas, setTandas] = useState(1)
  const tope = tandas * FILAS_POR_TANDA
  return {
    visibles: rows.length > tope ? rows.slice(0, tope) : rows,
    ocultas: Math.max(0, rows.length - tope),
    verMas: () => setTandas((t) => t + 1),
  }
}

/**
 * ⚠️ Esto NO afecta a la exportacion, y es deliberado: Excel y PDF siguen
 * llevandose el conjunto filtrado ENTERO. «Exporte y me faltan filas porque estaba
 * en la primera tanda» es el fallo clasico de las tablas paginadas y aqui no puede
 * pasar — el exportador lee de `filteredProcesses`, no de lo visible.
 */
function VerMasRow({ cols, ocultas, onVerMas }: { cols: number; ocultas: number; onVerMas: () => void }) {
  if (ocultas === 0) return null
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-3 text-center">
        <button
          onClick={onVerMas}
          className="px-4 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors"
        >
          Ver {Math.min(ocultas, FILAS_POR_TANDA)} mas · quedan {ocultas}
        </button>
        <p className="mt-1.5 text-[10px] text-white/20">La descarga incluye las {ocultas} restantes</p>
      </td>
    </tr>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    red: 'bg-red-500/15 text-red-400',
    amber: 'bg-amber-500/15 text-amber-400',
    gray: 'bg-white/5 text-white/20',
  }
  return <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${styles[color] || styles.gray}`}>{label}</span>
}

function RiskBadge({ label, hex }: { label: string; hex: string }) {
  return <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: `${hex}20`, color: hex }}>{label}</span>
}
