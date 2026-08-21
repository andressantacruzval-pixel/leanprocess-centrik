import { useMemo } from 'react'
import type { Process } from '@/types/process'
import type { StoredIndicator } from '@/stores/indicatorStore'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight,
  Th, Td, EmptyRow, VerMasRow, TableWrap, type Datum,
} from '../components/reportUi'
import { useVerMas } from '../components/reportPaging'
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
  const COLS = 15 + (org.hasL2 ? 1 : 0)
  const processMap = useMemo(() => new Map(processes.map((p) => [p.id, p])), [processes])
  const ids = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const kpis = useMemo(() => allIndicators.filter((i) => ids.has(i.process_id)), [allIndicators, ids])
  const { visibles, ocultas, verMas } = useVerMas(kpis)

  const withKpi = useMemo(() => new Set(kpis.map((i) => i.process_id)).size, [kpis])
  const byFreq = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    kpis.forEach((i) => { const k = i.frequency || 'Sin definir'; m.set(k, (m.get(k) || 0) + 1) })
    return [...m.entries()].map(([label, value], idx) => ({ label, value, color: FREQ_COLORS[idx % FREQ_COLORS.length] })).sort((a, b) => b.value - a.value)
  }, [kpis])
  const byProc = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    kpis.forEach((i) => { const n = processMap.get(i.process_id)?.name || '—'; m.set(n, (m.get(n) || 0) + 1) })
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#06b6d4' })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [kpis, processMap])

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
        <Card title="Por frecuencia" sub="Cada cuánto se mide."><Donut data={byFreq} center={String(kpis.length)} unit="KPIs" /></Card>
        <Card title="KPIs por proceso" sub="Top 8 más medidos."><HBars data={byProc} /></Card>
        <Card title="Calidad de la definición" sub={`Sobre ${kpis.length} indicadores.`}><HBars data={calidad} /></Card>
      </div>

      <div className="space-y-2">
        {sinKpi > 0 && <Insight tone="warn">{sinKpi} proceso(s) no tienen ningún indicador. Lo que no se mide no se gestiona: prioriza los procesos críticos.</Insight>}
        {kpis.length - conMeta > 0 && <Insight tone="warn">{kpis.length - conMeta} indicador(es) sin meta numérica. Sin meta no hay forma de saber si el resultado es bueno.</Insight>}
        {conUmbral === kpis.length && kpis.length > 0 && <Insight tone="ok">Todos los indicadores tienen semáforo (umbrales) configurado. Listos para tablero de control.</Insight>}
      </div>

      <TableWrap minWidth={1500}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            <Th>{org.l0}</Th><Th>{org.l1}</Th>{org.hasL2 && <Th>{org.l2}</Th>}<Th>Proceso</Th><Th>Indicador</Th><Th>Objetivo</Th>
            <Th>Fórmula</Th><Th>Fuente</Th><Th>Unidad</Th><Th>Frecuencia</Th><Th>Meta</Th>
            <Th>Verde</Th><Th>Amarillo</Th><Th>Rojo</Th><Th>Resp. reporte</Th><Th>Resp. monitoreo</Th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((i) => {
            const proc = processMap.get(i.process_id)
            return (
              <tr key={i.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors align-top">
                <Td>{proc?.management || '-'}</Td>
                <Td>{proc?.coordination || '-'}</Td>
                {org.hasL2 && <Td>{proc?.operative || '-'}</Td>}
                <Td className="max-w-[150px]"><div className="truncate">{proc?.name || '-'}</div></Td>
                <Td className="text-white font-medium max-w-[160px]"><div className="truncate" title={i.name}>{i.name}</div></Td>
                <Td className="max-w-[200px]"><div className="truncate" title={i.description}>{i.description || '-'}</div></Td>
                <Td className="max-w-[160px]"><div className="truncate" title={i.formula}>{i.formula || '-'}</div></Td>
                <Td className="max-w-[140px]"><div className="truncate" title={i.data_source}>{i.data_source || '-'}</div></Td>
                <Td>{i.unit || '-'}</Td>
                <Td>{i.frequency || '-'}</Td>
                <Td className="text-white/85">{i.target_value || '-'}</Td>
                <Td><span className="text-emerald-400">{range(i.threshold_green_min, i.threshold_green_max)}</span></Td>
                <Td><span className="text-amber-400">{range(i.threshold_yellow_min, i.threshold_yellow_max)}</span></Td>
                <Td><span className="text-red-400">{range(i.threshold_red_min, i.threshold_red_max)}</span></Td>
                <Td className="max-w-[120px]"><div className="truncate">{i.owner || '-'}</div></Td>
                <Td className="max-w-[120px]"><div className="truncate">{i.reporter || '-'}</div></Td>
              </tr>
            )
          })}
          {kpis.length === 0 && <EmptyRow cols={COLS} />}
          <VerMasRow cols={COLS} ocultas={ocultas} onVerMas={verMas} />
        </tbody>
      </TableWrap>
    </Dashboard>
  )
}
