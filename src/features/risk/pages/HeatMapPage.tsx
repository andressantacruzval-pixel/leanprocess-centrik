import { Fragment, useState, useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import {
  RISK_CATEGORIES,
  PROBABILITY_LABELS,
  IMPACT_LABELS,
  getRiskLevel,
  heatMapCellColor,
} from '@/types/risk'
import type { RiskItem, RiskCategory, ControlItem } from '@/types/risk'
import { Shield, Filter, ShieldAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { SelectFilter } from '@/components/ui/SelectFilter'
import { RiskDetailModal } from '@/features/risk/components/RiskDetailModal'
import { PageHeader } from '@/components/ui/PageHeader'

const PROB_ROWS = [5, 4, 3, 2, 1]
const IMP_COLS = [1, 2, 3, 4, 5]

export default function HeatMapPage() {
  const { processes, macroprocesses, risks: allRisks } = useCompanyScopedData()
  const levelDefinitions = useProcessStore((s) => s.levelDefinitions)

  // ── Filters ──────────────────────────────────────────────────────────
  const [filterCategory, setFilterCategory] = useState<RiskCategory | ''>('')
  const [filterMacro, setFilterMacro] = useState('')
  const [filterProcess, setFilterProcess] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [viewType, setViewType] = useState<'inherent' | 'residual'>('inherent')
  const [selectedCell, setSelectedCell] = useState<{ p: number; i: number } | null>(null)
  const [selectedRisk, setSelectedRisk] = useState<RiskItem | null>(null)

  const updateRisk = useRiskStore((s) => s.updateRisk)
  const deleteRisk = useRiskStore((s) => s.deleteRisk)
  const addControl = useRiskStore((s) => s.addControl)
  const updateControl = useRiskStore((s) => s.updateControl)
  const deleteControl = useRiskStore((s) => s.deleteControl)
  const storeRisks = useRiskStore((s) => s.risks)

  // Build process hierarchy lookup
  const processMap = useMemo(() => {
    const map = new Map<string, typeof processes[number]>()
    processes.forEach((p) => map.set(p.id, p))
    return map
  }, [processes])

  const macroMap = useMemo(() => {
    const map = new Map<string, typeof macroprocesses[number]>()
    macroprocesses.forEach((m) => map.set(m.id, m))
    return map
  }, [macroprocesses])

  // Filtered risks
  const filteredRisks = useMemo(() => {
    return allRisks.filter((risk) => {
      const proc = processMap.get(risk.process_id)
      if (!proc) return false

      if (filterCategory && risk.category !== filterCategory) return false
      if (filterMacro && proc.macroprocess_id !== filterMacro) return false
      if (filterProcess && risk.process_id !== filterProcess) return false
      if (filterArea && proc.coordination !== filterArea) return false

      return true
    })
  }, [allRisks, filterCategory, filterMacro, filterProcess, filterArea, processMap])

  // Cell counts
  const cellCounts = useMemo(() => {
    const counts: Record<string, RiskItem[]> = {}
    filteredRisks.forEach((r) => {
      const p = viewType === 'inherent' ? r.inherentProbability : r.residualProbability
      const i = viewType === 'inherent' ? r.inherentImpact : r.residualImpact
      const key = `${p}-${i}`
      if (!counts[key]) counts[key] = []
      counts[key].push(r)
    })
    return counts
  }, [filteredRisks, viewType])

  // Stats
  const stats = useMemo(() => {
    let critical = 0
    let high = 0
    let moderate = 0
    let low = 0
    filteredRisks.forEach((r) => {
      const p = viewType === 'inherent' ? r.inherentProbability : r.residualProbability
      const i = viewType === 'inherent' ? r.inherentImpact : r.residualImpact
      const level = getRiskLevel(p, i)
      if (level.label === 'Extremo') critical++
      else if (level.label === 'Alto') high++
      else if (level.label === 'Moderado') moderate++
      else low++
    })
    return { critical, high, moderate, low, total: filteredRisks.length }
  }, [filteredRisks, viewType])

  // Process options filtered by macro
  const processOptions = useMemo(() => {
    let filtered = processes
    if (filterMacro) filtered = filtered.filter((p) => p.macroprocess_id === filterMacro)
    return filtered
  }, [processes, filterMacro])

  // Area options
  const areaOptions = useMemo(() => {
    const areas = new Set<string>()
    processes.forEach((p) => { if (p.coordination) areas.add(p.coordination) })
    return Array.from(areas).sort()
  }, [processes])

  // Level name helper
  const getLevelName = (level: number) => {
    const def = levelDefinitions.find((l) => l.level_number === level)
    return def?.level_name ?? `Nivel ${level}`
  }

  // Risks in selected cell
  const cellRisks = useMemo(() => {
    if (!selectedCell) return []
    const key = `${selectedCell.p}-${selectedCell.i}`
    return cellCounts[key] || []
  }, [selectedCell, cellCounts])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Shield}
        iconClass="bg-red-500/15 border border-red-500/20"
        iconColor="text-red-400"
        title="Mapa de Calor de Riesgos"
        subtitle="Vision global de riesgos por probabilidad e impacto"
        actions={
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
            {(['inherent', 'residual'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setViewType(t)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewType === t
                    ? 'bg-cyan-600/20 text-cyan-300 shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t === 'inherent' ? 'Inherente' : 'Residual'}
              </button>
            ))}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white', bg: 'bg-white/5' },
          { label: 'Extremo', value: stats.critical, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Alto', value: stats.high, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Moderado', value: stats.moderate, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Bajo', value: stats.low, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 border border-white/5`}>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</span>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-white/40">
          <Filter size={14} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Filtros</span>
        </div>

        <SelectFilter
          placeholder="Categoria"
          value={filterCategory}
          onChange={(v) => setFilterCategory(v as RiskCategory | '')}
          options={RISK_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />

        <SelectFilter
          placeholder="Macroproceso"
          value={filterMacro}
          onChange={(v) => { setFilterMacro(v); setFilterProcess('') }}
          options={macroprocesses.map((m) => ({ value: m.id, label: m.name }))}
        />

        <SelectFilter
          placeholder={getLevelName(2)}
          value={filterProcess}
          onChange={setFilterProcess}
          options={processOptions.map((p) => ({ value: p.id, label: p.name }))}
        />

        <SelectFilter
          placeholder="Area"
          value={filterArea}
          onChange={setFilterArea}
          options={areaOptions.map((a) => ({ value: a, label: a }))}
        />

        {(filterCategory || filterMacro || filterProcess || filterArea) && (
          <button
            onClick={() => { setFilterCategory(''); setFilterMacro(''); setFilterProcess(''); setFilterArea('') }}
            className="px-3 py-1.5 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg border border-red-500/20 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Main content: Heat Map + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heat Map */}
        <div className="lg:col-span-2 bg-[#0d1420] rounded-2xl border border-white/5 p-4 sm:p-6">
          {/*
           * Las etiquetas de los ejes son celdas de la rejilla, no hijos absolutos de
           * los botones. Antes vivian DENTRO de cada celda con `-left-8` / `-bottom-5`:
           * se salian de la tarjeta (32px de desplazamiento contra 24px de padding) y,
           * peor, formaban parte del area clicable de la celda, asi que pulsar el
           * nombre de un nivel seleccionaba una casilla.
           *
           * La matriz no se encoge por debajo de `min-w`: se desplaza. Aplastarla es
           * perder justo lo que se viene a leer, que es la posicion de cada riesgo.
           */}
          <div className="overflow-x-auto">
            {/* `max-w` con celdas cuadradas: sin tope, en una pantalla ancha la matriz
                crecia hasta celdas de ~145px y una altura de 700px. El rango util queda
                entre ~62px (movil, con desplazamiento) y ~92px. */}
            <div className="min-w-[24rem] max-w-[34rem] mx-auto grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1.5">
              {PROB_ROWS.map((p) => (
                <Fragment key={p}>
                  <span className="pr-1 self-center text-right text-[10px] leading-tight text-white/35">
                    {PROBABILITY_LABELS[p]}
                  </span>
                  {IMP_COLS.map((i) => {
                    const key = `${p}-${i}`
                    const risks = cellCounts[key] || []
                    const count = risks.length
                    const isSelected = selectedCell?.p === p && selectedCell?.i === i
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedCell(count > 0 ? { p, i } : null)}
                        title={`${PROBABILITY_LABELS[p]} · ${IMPACT_LABELS[i]}`}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all ${heatMapCellColor(p, i)} ${
                          isSelected ? 'ring-2 ring-white/60 scale-105' : ''
                        } ${count > 0 ? 'shadow-lg' : 'opacity-70'}`}
                      >
                        {count > 0 && (
                          <>
                            <span className="text-xl sm:text-2xl font-bold text-white">{count}</span>
                            <span className="text-[8px] text-white/60 mt-0.5">
                              {count === 1 ? 'riesgo' : 'riesgos'}
                            </span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </Fragment>
              ))}

              {/* Fila de etiquetas de impacto, con la esquina vacia bajo el eje Y */}
              <span />
              {IMP_COLS.map((i) => (
                <span key={i} className="pt-1 text-center text-[10px] leading-tight text-white/35">
                  {IMPACT_LABELS[i]}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10px] text-white/35">
            <span>↑ Probabilidad</span>
            <span>Impacto →</span>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4">
            {[
              { label: 'Bajo', color: 'bg-green-600' },
              { label: 'Moderado', color: 'bg-yellow-600' },
              { label: 'Alto', color: 'bg-orange-600' },
              { label: 'Extremo', color: 'bg-red-600' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${l.color}`} />
                <span className="text-[10px] text-white/40">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {/* Tope de altura solo en escritorio: bajo `lg` este panel cae debajo del mapa
            y un scroll propio dentro del scroll de la pagina no ayuda a nadie. */}
        <div className="bg-[#0d1420] rounded-2xl border border-white/5 p-4 lg:overflow-y-auto lg:max-h-[600px]">
          {selectedCell ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  P={selectedCell.p}, I={selectedCell.i}
                </h3>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getRiskLevel(selectedCell.p, selectedCell.i).color} text-white`}>
                  {getRiskLevel(selectedCell.p, selectedCell.i).label}
                </span>
              </div>
              <div className="space-y-2">
                {cellRisks.map((risk) => {
                  const proc = processMap.get(risk.process_id)
                  const macro = proc ? macroMap.get(proc.macroprocess_id) : null
                  return (
                    <button
                      key={risk.id}
                      onClick={() => setSelectedRisk(risk)}
                      className="w-full text-left p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] hover:border-amber-500/20 transition-all cursor-pointer group"
                    >
                      <p className="text-xs font-medium text-white group-hover:text-amber-300 transition-colors">{risk.title}</p>
                      <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{risk.riskEvent || risk.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {risk.category}
                        </span>
                        {proc && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/5">
                            {proc.name}
                          </span>
                        )}
                        {macro && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {macro.name}
                          </span>
                        )}
                        <span className="text-[9px] text-white/30">
                          {risk.controls.length} control{risk.controls.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/20 py-20">
              <Shield size={32} className="mb-3" />
              <p className="text-xs text-center">Selecciona una celda del mapa<br />para ver los riesgos</p>
            </div>
          )}
        </div>
      </div>

      {/* Risk table */}
      {filteredRisks.length > 0 && (
        <div className="bg-[#0d1420] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">
              Listado de Riesgos ({filteredRisks.length})
            </h3>
          </div>
          {/* `min-w`: con 7 columnas, `w-full` a secas las aplasta en vez de dejar que
              la tabla se desplace. Mismo patron que ReportsPage. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-white/40 border-b border-white/5">
                  <th className="text-left px-4 py-2 font-medium">Riesgo</th>
                  <th className="text-left px-4 py-2 font-medium">Categoria</th>
                  <th className="text-left px-4 py-2 font-medium">Proceso</th>
                  <th className="text-center px-4 py-2 font-medium">P</th>
                  <th className="text-center px-4 py-2 font-medium">I</th>
                  <th className="text-center px-4 py-2 font-medium">Nivel</th>
                  <th className="text-center px-4 py-2 font-medium">Controles</th>
                </tr>
              </thead>
              <tbody>
                {filteredRisks.map((risk) => {
                  const proc = processMap.get(risk.process_id)
                  const p = viewType === 'inherent' ? risk.inherentProbability : risk.residualProbability
                  const i = viewType === 'inherent' ? risk.inherentImpact : risk.residualImpact
                  const level = getRiskLevel(p, i)
                  return (
                    <tr key={risk.id} onClick={() => setSelectedRisk(risk)} className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer">
                      <td className="px-4 py-2.5">
                        <p className="text-white font-medium">{risk.title}</p>
                        <p className="text-white/30 text-[10px] mt-0.5 truncate max-w-[250px]">{risk.riskEvent}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/5">
                          {risk.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/50">{proc?.name ?? '—'}</td>
                      <td className="text-center px-4 py-2.5 text-white/60">{p}</td>
                      <td className="text-center px-4 py-2.5 text-white/60">{i}</td>
                      <td className="text-center px-4 py-2.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${level.color} text-white`}>
                          {level.label}
                        </span>
                      </td>
                      <td className="text-center px-4 py-2.5 text-white/50">{risk.controls.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredRisks.length === 0 && (
        <EmptyState
          icon={ShieldAlert}
          title="Identifica riesgos en tus procesos"
          description="Agrega riesgos desde el diagramador BPMN para visualizarlos en el mapa de calor"
          actionLabel="Ir al Mapa de Procesos"
          actionHref="/app/process-map"
        />
      )}

      {selectedRisk && (() => {
        const live = storeRisks.find((r) => r.id === selectedRisk.id) ?? selectedRisk
        return (
          <RiskDetailModal
            risk={live}
            onUpdate={(updates) => {
              updateRisk(live.id, updates)
              setSelectedRisk((prev) => prev ? { ...prev, ...updates } : prev)
            }}
            onDelete={() => { deleteRisk(live.id); setSelectedRisk(null) }}
            onAddControl={() => addControl(live.id)}
            onUpdateControl={(controlId, updates) => updateControl(live.id, controlId, updates as Partial<ControlItem>)}
            onDeleteControl={(controlId) => deleteControl(live.id, controlId)}
            onClose={() => setSelectedRisk(null)}
          />
        )
      })()}
    </div>
  )
}

