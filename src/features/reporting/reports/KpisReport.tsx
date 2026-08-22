import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Process } from '@/types/process'
import type { StoredIndicator } from '@/stores/indicatorStore'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, type Datum,
} from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { OrgTopChart, type OrgTopItem } from '../components/OrgTopChart'
import { useOrgLabels } from '@/hooks/useOrgLabels'

// Reporte de KPIs: tablero (cobertura por proceso, frecuencias, calidad de la
// definición) + tabla con TODOS los campos del indicador, incluidos fuente de
// datos, responsable de reporte/monitoreo y los umbrales verde/amarillo/rojo.

const FREQ_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']

function range(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null) return `${min}–${max}`
  if (min != null) return `≥${min}`
  return `≤${max}`
}
const hasThresholds = (i: StoredIndicator) =>
  [i.threshold_green_min, i.threshold_green_max, i.threshold_yellow_min, i.threshold_yellow_max, i.threshold_red_min, i.threshold_red_max].some((v) => v != null)

export function KpisReport({ processes, allIndicators }: { processes: Process[]; allIndicators: StoredIndicator[] }) {
  const org = useOrgLabels()
  const processMap = useMemo(() => new Map(processes.map((p) => [p.id, p])), [processes])
  const ids = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const kpis = useMemo(() => allIndicators.filter((i) => ids.has(i.process_id)), [allIndicators, ids])

  const columns = useMemo<Column<StoredIndicator>[]>(() => [
    { key: 'l0', header: org.l0, accessor: (i) => processMap.get(i.process_id)?.management || '' },
    { key: 'l1', header: org.l1, accessor: (i) => processMap.get(i.process_id)?.coordination || '' },
    { key: 'l2', header: org.l2, hidden: !org.hasL2, accessor: (i) => processMap.get(i.process_id)?.operative || '' },
    { key: 'proc', header: 'Proceso', accessor: (i) => processMap.get(i.process_id)?.name || '', className: 'max-w-[150px]', cell: (i) => <div className="truncate">{processMap.get(i.process_id)?.name || '-'}</div> },
    { key: 'ind', header: 'Indicador', accessor: (i) => i.name || '', className: 'text-white font-medium max-w-[160px]', cell: (i) => <div className="truncate" title={i.name}>{i.name}</div> },
    { key: 'obj', header: 'Objetivo', accessor: (i) => i.description || '', className: 'max-w-[200px]', cell: (i) => <div className="truncate" title={i.description}>{i.description || '-'}</div> },
    { key: 'form', header: 'Fórmula', accessor: (i) => i.formula || '', className: 'max-w-[160px]', cell: (i) => <div className="truncate" title={i.formula}>{i.formula || '-'}</div> },
    { key: 'src', header: 'Fuente', accessor: (i) => i.data_source || '', className: 'max-w-[140px]', cell: (i) => <div className="truncate" title={i.data_source}>{i.data_source || '-'}</div> },
    { key: 'unit', header: 'Unidad', accessor: (i) => i.unit || '' },
    { key: 'freq', header: 'Frecuencia', accessor: (i) => i.frequency || '' },
    { key: 'meta', header: 'Meta', accessor: (i) => i.target_value || '', className: 'text-white/85' },
    { key: 'green', header: 'Verde', accessor: (i) => range(i.threshold_green_min, i.threshold_green_max), cell: (i) => <span className="text-emerald-400">{range(i.threshold_green_min, i.threshold_green_max)}</span> },
    { key: 'yellow', header: 'Amarillo', accessor: (i) => range(i.threshold_yellow_min, i.threshold_yellow_max), cell: (i) => <span className="text-amber-400">{range(i.threshold_yellow_min, i.threshold_yellow_max)}</span> },
    { key: 'red', header: 'Rojo', accessor: (i) => range(i.threshold_red_min, i.threshold_red_max), cell: (i) => <span className="text-red-400">{range(i.threshold_red_min, i.threshold_red_max)}</span> },
    { key: 'owner', header: 'Resp. reporte', accessor: (i) => i.owner || '', className: 'max-w-[120px]', cell: (i) => <div className="truncate">{i.owner || '-'}</div> },
    { key: 'reporter', header: 'Resp. monitoreo', accessor: (i) => i.reporter || '', className: 'max-w-[120px]', cell: (i) => <div className="truncate">{i.reporter || '-'}</div> },
  ], [org, processMap])

  const withKpi = useMemo(() => new Set(kpis.map((i) => i.process_id)).size, [kpis])
  const byFreq = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    kpis.forEach((i) => { const k = i.frequency || 'Sin definir'; m.set(k, (m.get(k) || 0) + 1) })
    return [...m.entries()].map(([label, value], idx) => ({ label, value, color: FREQ_COLORS[idx % FREQ_COLORS.length] })).sort((a, b) => b.value - a.value)
  }, [kpis])
  const kpiItems = useMemo<OrgTopItem[]>(() => kpis.map((i) => {
    const p = processMap.get(i.process_id)
    return { management: p?.management, coordination: p?.coordination, operative: p?.operative, process: p?.name }
  }), [kpis, processMap])

  const [freqFilter, setFreqFilter] = useState('')
  const shownKpis = useMemo(() => freqFilter ? kpis.filter((i) => (i.frequency || 'Sin definir') === freqFilter) : kpis, [kpis, freqFilter])

  const conMeta = kpis.filter((i) => (i.target_value || '').trim()).length
  const conUmbral = kpis.filter(hasThresholds).length
  const conResp = kpis.filter((i) => (i.owner || '').trim() || (i.reporter || '').trim()).length
  const sinKpi = processes.length - withKpi
  const calidad: Datum[] = [
    { label: 'Con meta', value: conMeta, color: '#10b981' },
    { label: 'Con umbrales', value: conUmbral, color: '#06b6d4' },
    { label: 'Con responsable', value: conResp, color: '#8b5cf6' },
  ]

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Indicadores" value={kpis.length} sub="definidos" tone="cyan" />
        <Stat label="Procesos medidos" value={`${withKpi}/${processes.length}`} sub={`${sinKpi} sin ningún KPI`} tone="emerald" />
        <Stat label="Con meta" value={`${kpis.length ? Math.round(conMeta / kpis.length * 100) : 0}%`} sub={`${kpis.length - conMeta} sin objetivo numérico`} tone="amber" />
        <Stat label="Con umbrales" value={`${kpis.length ? Math.round(conUmbral / kpis.length * 100) : 0}%`} sub="semáforo configurado" tone="violet" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Por frecuencia" sub="Clic para filtrar la tabla."><Donut data={byFreq} center={String(kpis.length)} unit="KPIs" onSlice={(l) => setFreqFilter(freqFilter === l ? '' : l)} active={freqFilter} /></Card>
        <OrgTopChart title="KPIs" sub="Top 8 por nivel." items={kpiItems} org={org} />
        <Card title="Calidad de la definición" sub={`Sobre ${kpis.length} indicadores.`}><HBars data={calidad} /></Card>
      </div>

      <div className="space-y-2">
        {sinKpi > 0 && <Insight tone="warn">{sinKpi} proceso(s) no tienen ningún indicador. Lo que no se mide no se gestiona: prioriza los procesos críticos.</Insight>}
        {kpis.length - conMeta > 0 && <Insight tone="warn">{kpis.length - conMeta} indicador(es) sin meta numérica. Sin meta no hay forma de saber si el resultado es bueno.</Insight>}
        {conUmbral === kpis.length && kpis.length > 0 && <Insight tone="ok">Todos los indicadores tienen semáforo (umbrales) configurado. Listos para tablero de control.</Insight>}
      </div>

      {freqFilter && (
        <div className="flex items-center gap-2 -mb-1">
          <span className="text-[11px] text-white/45">Tabla filtrada por frecuencia:</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {freqFilter}
            <button onClick={() => setFreqFilter('')} className="hover:text-white" title="Quitar filtro"><X size={12} /></button>
          </span>
        </div>
      )}
      <DataTable columns={columns} rows={shownKpis} minWidth={1500} rowKey={(i) => i.id} />
    </Dashboard>
  )
}
