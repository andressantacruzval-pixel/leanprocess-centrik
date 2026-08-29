import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Process, Macroprocess } from '@/types/process'
import {
  CLASSIFICATION_COLORS, computeKPIs, computePareto, scaleToPeriod, formatTime,
  type ValueActivity, type ValueClassification,
} from '@/utils/valueAnalysis'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, type Datum,
} from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { hierarchyColumns } from '../components/hierarchyColumns'
import { resolveProcessHierarchy } from '@/lib/reportHierarchy'
import { OrgTopChart, type OrgTopItem } from '../components/OrgTopChart'
import { useOrgLabels } from '@/hooks/useOrgLabels'

type ValueRow = { process: Process; activity: ValueActivity }

// Reporte de Análisis de Valor: tablero (VA/NVA/NVABN, eficiencia, desperdicio,
// Pareto de las actividades que más tiempo consumen) + tabla de tiempos por
// actividad escalados a día/mes/año.

const CLS: ValueClassification[] = ['VA', 'NVA', 'NVABN']

export function ValueReport({ processes, allAnalyses, macroMap, processMap }: { processes: Process[]; allAnalyses: Record<string, ValueActivity[]>; macroMap: Map<string, Macroprocess>; processMap: Map<string, Process> }) {
  const rows = useMemo(() => {
    const out: ValueRow[] = []
    for (const p of processes) for (const a of (allAnalyses[p.id] || [])) out.push({ process: p, activity: a })
    return out
  }, [processes, allAnalyses])
  const org = useOrgLabels()
  const activities = useMemo(() => rows.map((r) => r.activity), [rows])
  const k = useMemo(() => computeKPIs(activities), [activities])
  const pareto = useMemo(() => computePareto(activities, 'mes').slice(0, 8), [activities])

  const columns = useMemo<Column<ValueRow>[]>(() => [
    ...hierarchyColumns<ValueRow>(org, (r) => ({
      management: r.process.management, coordination: r.process.coordination, operative: r.process.operative,
      ...resolveProcessHierarchy(r.process, macroMap, processMap),
    })),
    { key: 'act', header: 'Actividad', accessor: (r) => r.activity.name || '', className: 'text-gray-900 font-medium max-w-[200px]', cell: (r) => <div className="truncate" title={r.activity.name}>{r.activity.name}</div> },
    { key: 'resp', header: 'Responsable', accessor: (r) => r.activity.laneName || '', className: 'max-w-[120px]', cell: (r) => <div className="truncate">{r.activity.laneName || '-'}</div> },
    {
      key: 'cls', header: 'Clasificación', accessor: (r) => r.activity.classification || '',
      cell: (r) => { const cls = r.activity.classification; const c = cls ? CLASSIFICATION_COLORS[cls] : null; return cls && c ? <Badge label={cls} hex={c.hex} /> : '-' },
    },
    { key: 'freq', header: 'Frecuencia', accessor: (r) => r.activity.frequency || '' },
    { key: 'tpo', header: 'Min/ocurr.', accessor: (r) => r.activity.timePerOccurrence || 0, cell: (r) => r.activity.timePerOccurrence || '-' },
    { key: 'occ', header: 'Ocurr.', accessor: (r) => r.activity.occurrences || 0, cell: (r) => r.activity.occurrences || '-' },
    { key: 'dia', header: 'Min/día', accessor: (r) => r.activity.dailyMinutes || 0, cell: (r) => { const dm = r.activity.dailyMinutes; return dm ? Math.round(dm * 10) / 10 : '-' } },
    { key: 'mes', header: 'Min/mes', accessor: (r) => { const dm = r.activity.dailyMinutes; return dm ? Math.round(scaleToPeriod(dm, 'mes')) : 0 }, cell: (r) => { const dm = r.activity.dailyMinutes; return dm ? Math.round(scaleToPeriod(dm, 'mes')) : '-' } },
    { key: 'anio', header: 'Hrs/año', accessor: (r) => { const dm = r.activity.dailyMinutes; return dm ? Math.round(scaleToPeriod(dm, 'año') / 60 * 10) / 10 : 0 }, cell: (r) => { const dm = r.activity.dailyMinutes; return dm ? Math.round(scaleToPeriod(dm, 'año') / 60 * 10) / 10 : '-' } },
  ], [org, macroMap, processMap])

  const byClassTime = useMemo<Datum[]>(() => CLS.map((c) => ({
    label: CLASSIFICATION_COLORS[c].label, color: CLASSIFICATION_COLORS[c].hex,
    value: Math.round((c === 'VA' ? k.vaDailyMinutes : c === 'NVA' ? k.nvaDailyMinutes : k.nvabnDailyMinutes) * 20),
  })), [k])
  const wasteItems = useMemo<OrgTopItem[]>(() => rows
    .filter(({ activity }) => activity.classification === 'NVA')
    .map(({ process, activity }) => ({ management: process.management, coordination: process.coordination, operative: process.operative, process: process.name, value: scaleToPeriod(activity.dailyMinutes, 'mes') })),
    [rows])
  const topTime = useMemo<Datum[]>(() => pareto.map((p) => ({
    label: p.activity.name, value: Math.round(p.scaledMinutes),
    color: p.activity.classification ? CLASSIFICATION_COLORS[p.activity.classification].hex : '#64748b',
  })), [pareto])

  const clsByLabel = useMemo(() => Object.fromEntries(CLS.map((c) => [CLASSIFICATION_COLORS[c].label, c])) as Record<string, ValueClassification>, [])
  const [clsFilter, setClsFilter] = useState<ValueClassification | ''>('')
  const shownRows = useMemo(() => clsFilter ? rows.filter((r) => r.activity.classification === clsFilter) : rows, [rows, clsFilter])
  const clsActiveLabel = clsFilter ? CLASSIFICATION_COLORS[clsFilter].label : ''

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Actividades" value={k.totalActivities} sub={`${k.unclassifiedCount} sin clasificar`} tone="cyan" />
        <Stat label="Eficiencia (VA)" value={`${Math.round(k.vaEfficiency)}%`} sub="del tiempo agrega valor" tone="emerald" />
        <Stat label="Desperdicio (NVA)" value={`${Math.round(k.wastePercentage)}%`} sub="candidato a eliminar" tone="red" />
        <Stat label="Tiempo de ciclo" value={formatTime(k.cycleTimeMinutes)} sub="suma por ocurrencia" tone="violet" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Tiempo por clasificación" sub="Clic para filtrar la tabla."><Donut data={byClassTime} center={`${Math.round(k.vaEfficiency)}%`} unit="VA" onSlice={(l) => setClsFilter(clsActiveLabel === l ? '' : (clsByLabel[l] ?? ''))} active={clsActiveLabel} /></Card>
        <Card title="Actividades que más tiempo consumen" sub="Pareto 80/20 (min/mes)."><HBars data={topTime} /></Card>
        <OrgTopChart title="Desperdicio" sub="Tiempo NVA (min/mes) por nivel." items={wasteItems} org={org} color="#f87171" />
      </div>

      <div className="space-y-2">
        {k.wastePercentage >= 30 && <Insight tone="crit">El {Math.round(k.wastePercentage)}% del tiempo es desperdicio (NVA). Atacar las actividades NVA del Pareto libera capacidad sin contratar.</Insight>}
        {k.unclassifiedCount > 0 && <Insight tone="warn">{k.unclassifiedCount} actividad(es) sin clasificar. El análisis queda incompleto hasta clasificarlas como VA/NVA/NVABN.</Insight>}
        {k.vaEfficiency >= 60 && <Insight tone="ok">Eficiencia de valor del {Math.round(k.vaEfficiency)}%. Buen punto de partida; enfoca la mejora en el {Math.round(k.wastePercentage)}% NVA.</Insight>}
      </div>

      {clsFilter && (
        <div className="flex items-center gap-2 -mb-1">
          <span className="text-[11px] text-gray-500">Tabla filtrada por clasificación:</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
            {clsActiveLabel}
            <button onClick={() => setClsFilter('')} className="hover:text-gray-900" title="Quitar filtro"><X size={12} /></button>
          </span>
        </div>
      )}
      <DataTable columns={columns} rows={shownRows} minWidth={1300} rowKey={(r, i) => `${r.process.id}-${r.activity.id}-${i}`} />
    </Dashboard>
  )
}
