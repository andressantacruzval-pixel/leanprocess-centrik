import { useMemo } from 'react'
import type { Process } from '@/types/process'
import {
  CLASSIFICATION_COLORS, computeKPIs, computePareto, scaleToPeriod, formatTime,
  type ValueActivity, type ValueClassification,
} from '@/utils/valueAnalysis'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge,
  Th, Td, EmptyRow, VerMasRow, TableWrap, type Datum,
} from '../components/reportUi'
import { useVerMas } from '../components/reportPaging'

// Reporte de Análisis de Valor: tablero (VA/NVA/NVABN, eficiencia, desperdicio,
// Pareto de las actividades que más tiempo consumen) + tabla de tiempos por
// actividad escalados a día/mes/año.

const CLS: ValueClassification[] = ['VA', 'NVA', 'NVABN']

export function ValueReport({ processes, allAnalyses }: { processes: Process[]; allAnalyses: Record<string, ValueActivity[]> }) {
  const rows = useMemo(() => {
    const out: { process: Process; activity: ValueActivity }[] = []
    for (const p of processes) for (const a of (allAnalyses[p.id] || [])) out.push({ process: p, activity: a })
    return out
  }, [processes, allAnalyses])
  const activities = useMemo(() => rows.map((r) => r.activity), [rows])
  const k = useMemo(() => computeKPIs(activities), [activities])
  const pareto = useMemo(() => computePareto(activities, 'mes').slice(0, 8), [activities])
  const { visibles, ocultas, verMas } = useVerMas(rows)

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

      <TableWrap minWidth={1300}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            <Th>Gerencia</Th><Th>Área</Th><Th>Proceso</Th><Th>Actividad</Th><Th>Responsable</Th>
            <Th>Clasificación</Th><Th>Frecuencia</Th><Th>Min/ocurr.</Th><Th>Ocurr.</Th><Th>Min/día</Th><Th>Min/mes</Th><Th>Hrs/año</Th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((row, i) => {
            const cls = row.activity.classification
            const c = cls ? CLASSIFICATION_COLORS[cls] : null
            const dm = row.activity.dailyMinutes
            return (
              <tr key={`${row.process.id}-${row.activity.id}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors align-top">
                <Td>{row.process.management || '-'}</Td>
                <Td>{row.process.coordination || '-'}</Td>
                <Td className="max-w-[150px]"><div className="truncate">{row.process.name}</div></Td>
                <Td className="text-white font-medium max-w-[200px]"><div className="truncate" title={row.activity.name}>{row.activity.name}</div></Td>
                <Td className="max-w-[120px]"><div className="truncate">{row.activity.laneName || '-'}</div></Td>
                <Td>{cls && c ? <Badge label={cls} hex={c.hex} /> : '-'}</Td>
                <Td>{row.activity.frequency || '-'}</Td>
                <Td>{row.activity.timePerOccurrence || '-'}</Td>
                <Td>{row.activity.occurrences || '-'}</Td>
                <Td>{dm ? Math.round(dm * 10) / 10 : '-'}</Td>
                <Td>{dm ? Math.round(scaleToPeriod(dm, 'mes')) : '-'}</Td>
                <Td>{dm ? Math.round(scaleToPeriod(dm, 'año') / 60 * 10) / 10 : '-'}</Td>
              </tr>
            )
          })}
          {rows.length === 0 && <EmptyRow cols={12} />}
          <VerMasRow cols={12} ocultas={ocultas} onVerMas={verMas} />
        </tbody>
      </TableWrap>
    </Dashboard>
  )
}
