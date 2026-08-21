import { useMemo } from 'react'
import type { Process } from '@/types/process'
import {
  CLASSIFICATION_COLORS, computeKPIs, computePareto, scaleToPeriod, formatTime,
  type ValueActivity, type ValueClassification,
} from '@/utils/valueAnalysis'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, type Datum,
} from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { useOrgLabels } from '@/hooks/useOrgLabels'

type ValueRow = { process: Process; activity: ValueActivity }

// Reporte de Análisis de Valor: tablero (VA/NVA/NVABN, eficiencia, desperdicio,
// Pareto de las actividades que más tiempo consumen) + tabla de tiempos por
// actividad escalados a día/mes/año.

const CLS: ValueClassification[] = ['VA', 'NVA', 'NVABN']

export function ValueReport({ processes, allAnalyses }: { processes: Process[]; allAnalyses: Record<string, ValueActivity[]> }) {
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
    { key: 'l0', header: org.l0, accessor: (r) => r.process.management || '' },
    { key: 'l1', header: org.l1, accessor: (r) => r.process.coordination || '' },
    { key: 'l2', header: org.l2, hidden: !org.hasL2, accessor: (r) => r.process.operative || '' },
    { key: 'proc', header: 'Proceso', accessor: (r) => r.process.name || '', className: 'max-w-[150px]', cell: (r) => <div className="truncate">{r.process.name}</div> },
    { key: 'act', header: 'Actividad', accessor: (r) => r.activity.name || '', className: 'text-white font-medium max-w-[200px]', cell: (r) => <div className="truncate" title={r.activity.name}>{r.activity.name}</div> },
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
  ], [org])

  const byClassTime = useMemo<Datum[]>(() => CLS.map((c) => ({
    label: CLASSIFICATION_COLORS[c].label, color: CLASSIFICATION_COLORS[c].hex,
    value: Math.round((c === 'VA' ? k.vaDailyMinutes : c === 'NVA' ? k.nvaDailyMinutes : k.nvabnDailyMinutes) * 20),
  })), [k])
  const wasteByProc = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    rows.forEach(({ process, activity }) => {
      if (activity.classification === 'NVA') m.set(process.name, (m.get(process.name) || 0) + scaleToPeriod(activity.dailyMinutes, 'mes'))
    })
    return [...m.entries()].map(([label, value]) => ({ label, value: Math.round(value), color: '#f87171' })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [rows])
  const topTime = useMemo<Datum[]>(() => pareto.map((p) => ({
    label: p.activity.name, value: Math.round(p.scaledMinutes),
    color: p.activity.classification ? CLASSIFICATION_COLORS[p.activity.classification].hex : '#64748b',
  })), [pareto])

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Actividades" value={k.totalActivities} sub={`${k.unclassifiedCount} sin clasificar`} tone="cyan" />
        <Stat label="Eficiencia (VA)" value={`${Math.round(k.vaEfficiency)}%`} sub="del tiempo agrega valor" tone="emerald" />
        <Stat label="Desperdicio (NVA)" value={`${Math.round(k.wastePercentage)}%`} sub="candidato a eliminar" tone="red" />
        <Stat label="Tiempo de ciclo" value={formatTime(k.cycleTimeMinutes)} sub="suma por ocurrencia" tone="violet" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Tiempo por clasificación" sub="Minutos/mes estimados."><Donut data={byClassTime} center={`${Math.round(k.vaEfficiency)}%`} unit="VA" /></Card>
        <Card title="Actividades que más tiempo consumen" sub="Pareto 80/20 (min/mes)."><HBars data={topTime} /></Card>
        <Card title="Desperdicio por proceso" sub="Tiempo NVA (min/mes)."><HBars data={wasteByProc} /></Card>
      </div>

      <div className="space-y-2">
        {k.wastePercentage >= 30 && <Insight tone="crit">El {Math.round(k.wastePercentage)}% del tiempo es desperdicio (NVA). Atacar las actividades NVA del Pareto libera capacidad sin contratar.</Insight>}
        {k.unclassifiedCount > 0 && <Insight tone="warn">{k.unclassifiedCount} actividad(es) sin clasificar. El análisis queda incompleto hasta clasificarlas como VA/NVA/NVABN.</Insight>}
        {k.vaEfficiency >= 60 && <Insight tone="ok">Eficiencia de valor del {Math.round(k.vaEfficiency)}%. Buen punto de partida; enfoca la mejora en el {Math.round(k.wastePercentage)}% NVA.</Insight>}
      </div>

      <DataTable columns={columns} rows={rows} minWidth={1300} rowKey={(r, i) => `${r.process.id}-${r.activity.id}-${i}`} />
    </Dashboard>
  )
}
