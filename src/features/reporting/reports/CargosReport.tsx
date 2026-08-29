import { useMemo, useState } from 'react'
import { Search, X, Plus, ChevronRight, ChevronDown, UserCog } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import {
  useCargoData, CARGO_CATALOG, scaleDaily, PERIOD_LABELS, PERIOD_OPTIONS,
  type CargoAgg, type CargoPeriod,
} from '@/features/cargos/cargoData'
import { CLASSIFICATION_COLORS } from '@/utils/valueAnalysis'
import {
  Dashboard, Grid, Card, Stat, HBars, Insight, Badge,
  Th, Td, EmptyRow, TableWrap, type Datum,
} from '../components/reportUi'

// Reporte por Cargo: procesos, actividades y tiempo (VA/NVA/NVABN) por cargo,
// con periodo (día/semana/mes/semestre/año) y unidad (min/horas) configurables,
// igual que el diagramador. Detecta cargos sin catalogar y los da de alta.

export function CargosReport() {
  const companyId = useWorkspaceStore((s) => s.activeCompanyId) ?? ''
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const { cargos, sinCatalogar } = useCargoData(companyId)

  const [q, setQ] = useState('')
  const [soloSin, setSoloSin] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [period, setPeriod] = useState<CargoPeriod>('mes')
  const [unit, setUnit] = useState<'min' | 'h'>('min')
  // Filtro por clic en los gráficos (todos agrupan por cargo). Clic de nuevo en el
  // mismo cargo lo quita. Igual que Riesgos/Activos/Aplicaciones.
  const [pickCargo, setPickCargo] = useState<string | null>(null)
  const togglePick = (label: string) => setPickCargo((p) => (p === label ? null : label))

  // Formateo del tiempo según periodo/unidad elegidos.
  const fmt = (dailyMinutes: number): string => {
    if (!dailyMinutes) return '-'
    const v = scaleDaily(dailyMinutes, period, unit)
    return unit === 'h' ? (Math.round(v * 10) / 10).toLocaleString('es') : Math.round(v).toLocaleString('es')
  }
  const unitLabel = `${unit === 'h' ? 'h' : 'min'}/${PERIOD_LABELS[period].toLowerCase()}`

  const shown = useMemo(() => cargos.filter((c) =>
    (!q || c.cargo.toLowerCase().includes(q.toLowerCase())) &&
    (!soloSin || (!c.inCatalog && c.activities.length > 0)) &&
    (!pickCargo || c.cargo === pickCargo)
  ), [cargos, q, soloSin, pickCargo])

  if (!cargos.length) {
    return (
      <div className="p-10 text-center">
        <UserCog size={28} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-900">Aún no hay cargos</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Los cargos salen de los <b className="text-gray-700">lanes</b> de tus diagramas BPMN. Dibuja un flujograma con roles y aquí verás, por cargo, cuántos procesos y actividades tiene y su tiempo de valor.</p>
      </div>
    )
  }

  const conActividad = cargos.filter((c) => c.activities.length > 0)
  const totalAct = conActividad.reduce((s, c) => s + c.activities.length, 0)
  const totalVa = conActividad.reduce((s, c) => s + c.vaDaily, 0)
  const totalMed = conActividad.reduce((s, c) => s + c.totalDaily, 0)
  const pctVaGlobal = totalMed > 0 ? Math.round(totalVa / totalMed * 100) : 0

  const byAct = conActividad.slice(0, 8).map<Datum>((c) => ({ label: c.cargo, value: c.activities.length, color: '#06b6d4' }))
  const byNva = [...conActividad].sort((a, b) => b.nvaDaily - a.nvaDaily).slice(0, 8)
    .filter((c) => c.nvaDaily > 0).map<Datum>((c) => ({ label: c.cargo, value: Math.round(scaleDaily(c.nvaDaily, period, unit)), color: '#f87171' }))
  const byProc = [...conActividad].sort((a, b) => b.processes.size - a.processes.size).slice(0, 8)
    .map<Datum>((c) => ({ label: c.cargo, value: c.processes.size, color: '#8b5cf6' }))

  const toggle = (k: string) => setOpen((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Cargos" value={conActividad.length} sub={`${cargos.length - conActividad.length} en catálogo sin uso`} tone="cyan" />
        <Stat label="Sin catalogar" value={sinCatalogar.length} sub="aparecen en diagramas" tone={sinCatalogar.length ? 'amber' : 'emerald'} />
        <Stat label="Actividades mapeadas" value={totalAct} sub="con cargo asignado" tone="violet" />
        <Stat label="Valor global" value={`${pctVaGlobal}%`} sub="del tiempo agrega valor" tone="emerald" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Cargos con más actividades" sub="Clic para filtrar la tabla."><HBars data={byAct} onBar={togglePick} active={pickCargo ?? undefined} /></Card>
        <Card title="Desperdicio por cargo" sub={`Clic para filtrar (${unitLabel}).`}><HBars data={byNva} onBar={togglePick} active={pickCargo ?? undefined} /></Card>
        <Card title="Cargos por N.º de procesos" sub="Clic para filtrar la tabla."><HBars data={byProc} onBar={togglePick} active={pickCargo ?? undefined} /></Card>
      </div>

      <div className="space-y-2">
        {sinCatalogar.length > 0 && <Insight tone="warn">{sinCatalogar.length} cargo(s) aparecen en los diagramas pero no están en el catálogo: {sinCatalogar.slice(0, 4).map((c) => c.cargo).join(', ')}{sinCatalogar.length > 4 ? '…' : ''}. Agrégalos para conciliar la analítica.</Insight>}
        {byNva.length > 0 && <Insight tone="crit">«{byNva[0].label}» concentra {byNva[0].value.toLocaleString('es')} {unitLabel} en actividades sin valor (NVA). Candidato a rediseñar o redistribuir carga.</Insight>}
        {pctVaGlobal >= 60 && <Insight tone="ok">El {pctVaGlobal}% del tiempo con cargo asignado agrega valor. Enfoca la mejora en el resto.</Insight>}
      </div>

      {/* Filtros + periodo/unidad */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-3 py-1.5 flex-1 max-w-[240px]">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cargo…" className="bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none flex-1 min-w-0" />
          {q && <button onClick={() => setQ('')} className="text-gray-400 hover:text-gray-500"><X size={12} /></button>}
        </div>
        <button onClick={() => setSoloSin((v) => !v)} className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${soloSin ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:text-gray-800'}`}>Solo sin catalogar</button>
        {pickCargo && <button onClick={() => setPickCargo(null)} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100">{pickCargo} <X size={12} /></button>}
        <div className="ml-auto flex items-center gap-2">
          <PeriodSel value={period} onChange={setPeriod} />
          <UnitSel value={unit} onChange={setUnit} />
        </div>
      </div>

      <TableWrap minWidth={1100}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <Th> </Th><Th>Cargo</Th><Th>Catálogo</Th><Th>Procesos</Th><Th>Actividades</Th>
            <Th>{`VA ${unitLabel}`}</Th><Th>{`NVA ${unitLabel}`}</Th><Th>{`NVABN ${unitLabel}`}</Th><Th>% Valor</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => {
            const pv = c.totalDaily > 0 ? Math.round(c.vaDaily / c.totalDaily * 100) : null
            const isOpen = open.has(c.key)
            return [
              <tr key={c.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <Td>
                  {c.activities.length > 0 && (
                    <button onClick={() => toggle(c.key)} className="text-gray-500 hover:text-gray-800">
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  )}
                </Td>
                <Td className="text-gray-900 font-medium">{c.cargo}</Td>
                <Td>
                  {c.inCatalog
                    ? <Badge label="En catálogo" hex="#10b981" />
                    : c.activities.length > 0
                      ? <button onClick={() => addCatalogItem(CARGO_CATALOG, c.cargo)} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100"><Plus size={10} /> Agregar</button>
                      : <span className="text-gray-400">—</span>}
                </Td>
                <Td className="tabular-nums">{c.processes.size}</Td>
                <Td className="tabular-nums text-gray-800">{c.activities.length}</Td>
                <Td className="tabular-nums"><span style={{ color: CLASSIFICATION_COLORS.VA.hex }}>{fmt(c.vaDaily)}</span></Td>
                <Td className="tabular-nums"><span style={{ color: CLASSIFICATION_COLORS.NVA.hex }}>{fmt(c.nvaDaily)}</span></Td>
                <Td className="tabular-nums"><span style={{ color: CLASSIFICATION_COLORS.NVABN.hex }}>{fmt(c.nvabnDaily)}</span></Td>
                <Td>{pv == null ? <span className="text-gray-400">s/valorar</span> : <span className={pv >= 60 ? 'text-emerald-600' : pv >= 30 ? 'text-amber-600' : 'text-red-600'}>{pv}%</span>}</Td>
              </tr>,
              isOpen && (
                <tr key={c.key + '-d'} className="bg-gray-900/45">
                  <td colSpan={9} className="px-3 py-2">
                    <CargoDetail cargo={c} fmt={fmt} unitLabel={unitLabel} />
                  </td>
                </tr>
              ),
            ]
          })}
          {shown.length === 0 && <EmptyRow cols={9} />}
        </tbody>
      </TableWrap>
    </Dashboard>
  )
}

function PeriodSel({ value, onChange }: { value: CargoPeriod; onChange: (v: CargoPeriod) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
      Periodo
      <select value={value} onChange={(e) => onChange(e.target.value as CargoPeriod)} className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] text-gray-800 outline-none cursor-pointer focus:ring-2 focus:ring-primary-500">
        {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
      </select>
    </label>
  )
}
function UnitSel({ value, onChange }: { value: 'min' | 'h'; onChange: (v: 'min' | 'h') => void }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
      {(['min', 'h'] as const).map((u) => (
        <button key={u} onClick={() => onChange(u)} className={`px-2 py-1 rounded-md text-[11px] ${value === u ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{u === 'h' ? 'Horas' : 'Minutos'}</button>
      ))}
    </div>
  )
}

function CargoDetail({ cargo, fmt, unitLabel }: { cargo: CargoAgg; fmt: (d: number) => string; unitLabel: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
        <span>Actividades de «{cargo.cargo}» ({cargo.activities.length})</span>
        <span>{unitLabel}</span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-1">
        {cargo.activities.map((a, i) => {
          const c = a.classification ? CLASSIFICATION_COLORS[a.classification] : null
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[11px]">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c ? c.hex : 'rgba(255,255,255,0.2)' }} />
                <span className="text-gray-700 truncate">{a.activityName}</span>
              </span>
              <span className="text-gray-400 truncate max-w-[160px] text-right">{a.processName}</span>
              <span className="text-gray-600 tabular-nums w-20 text-right">{fmt(a.dailyMinutes)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
