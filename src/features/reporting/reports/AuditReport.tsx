import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Process } from '@/types/process'
import type { AuditItem } from '@/lib/procedureAi'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, type Datum,
} from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { OrgTopChart, type OrgTopItem } from '../components/OrgTopChart'
import { useOrgLabels } from '@/hooks/useOrgLabels'

type AuditRow = { process: Process; item: AuditItem }

// Reporte de Programa de Auditoría: tablero (cobertura, carga por responsable,
// frecuencias, calidad del criterio) + tabla completa de puntos de control.

const FREQ_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']

export function AuditReport({ processes, allAudits }: { processes: Process[]; allAudits: Record<string, AuditItem[]> }) {
  const org = useOrgLabels()
  const rows = useMemo(() => {
    const out: AuditRow[] = []
    for (const p of processes) for (const item of (allAudits[p.id] || [])) out.push({ process: p, item })
    return out
  }, [processes, allAudits])

  const columns = useMemo<Column<AuditRow>[]>(() => [
    { key: 'l0', header: org.l0, accessor: (r) => r.process.management || '' },
    { key: 'l1', header: org.l1, accessor: (r) => r.process.coordination || '' },
    { key: 'l2', header: org.l2, hidden: !org.hasL2, accessor: (r) => r.process.operative || '' },
    { key: 'proc', header: 'Proceso', accessor: (r) => r.process.name || '', className: 'max-w-[150px]', cell: (r) => <div className="truncate">{r.process.name || '-'}</div> },
    { key: 'act', header: 'Actividad', accessor: (r) => r.item.actividad || '', className: 'max-w-[200px]', cell: (r) => <div className="truncate" title={r.item.actividad}>{r.item.actividad || '-'}</div> },
    { key: 'que', header: 'Qué auditar', accessor: (r) => r.item.queAuditar || '', className: 'text-white font-medium max-w-[200px]', cell: (r) => <div className="truncate" title={r.item.queAuditar}>{r.item.queAuditar || '-'}</div> },
    { key: 'crit', header: 'Criterio', accessor: (r) => r.item.criterio || '', className: 'max-w-[180px]', cell: (r) => <div className="truncate" title={r.item.criterio}>{r.item.criterio || '-'}</div> },
    { key: 'evi', header: 'Evidencia', accessor: (r) => r.item.evidencia || '', className: 'max-w-[160px]', cell: (r) => <div className="truncate" title={r.item.evidencia}>{r.item.evidencia || '-'}</div> },
    { key: 'freq', header: 'Frecuencia', accessor: (r) => r.item.frecuencia || '' },
    { key: 'resp', header: 'Responsable', accessor: (r) => r.item.responsable || '', className: 'max-w-[130px]', cell: (r) => <div className="truncate">{r.item.responsable || '-'}</div> },
  ], [org])

  const covered = useMemo(() => processes.filter((p) => (allAudits[p.id] || []).length > 0).length, [processes, allAudits])
  const byFreq = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    rows.forEach(({ item }) => { const k = item.frecuencia || 'Sin definir'; m.set(k, (m.get(k) || 0) + 1) })
    return [...m.entries()].map(([label, value], idx) => ({ label, value, color: FREQ_COLORS[idx % FREQ_COLORS.length] })).sort((a, b) => b.value - a.value)
  }, [rows])
  const byResp = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    rows.forEach(({ item }) => { const k = item.responsable || 'Sin asignar'; m.set(k, (m.get(k) || 0) + 1) })
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#8b5cf6' })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [rows])
  const controlItems = useMemo<OrgTopItem[]>(() => rows.map(({ process }) => ({
    management: process.management, coordination: process.coordination, operative: process.operative, process: process.name,
  })), [rows])

  const [barFilter, setBarFilter] = useState<{ dim: 'freq' | 'resp'; value: string } | null>(null)
  const toggleBar = (dim: 'freq' | 'resp', value: string) =>
    setBarFilter((prev) => (prev && prev.dim === dim && prev.value === value ? null : { dim, value }))
  const shownRows = useMemo(() => {
    if (!barFilter) return rows
    return rows.filter(({ item }) => barFilter.dim === 'freq'
      ? (item.frecuencia || 'Sin definir') === barFilter.value
      : (item.responsable || 'Sin asignar') === barFilter.value)
  }, [rows, barFilter])

  const sinCriterio = rows.filter(({ item }) => !(item.criterio || '').trim()).length
  const sinEvidencia = rows.filter(({ item }) => !(item.evidencia || '').trim()).length
  const sinResp = rows.filter(({ item }) => !(item.responsable || '').trim()).length
  const noCubiertos = processes.length - covered

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Puntos de control" value={rows.length} sub="a auditar" tone="cyan" />
        <Stat label="Procesos cubiertos" value={`${covered}/${processes.length}`} sub={`${noCubiertos} sin programa`} tone="emerald" />
        <Stat label="Con criterio" value={`${rows.length ? Math.round((rows.length - sinCriterio) / rows.length * 100) : 0}%`} sub={`${sinCriterio} sin criterio`} tone="amber" />
        <Stat label="Responsables" value={byResp.length} sub="distintos auditores" tone="violet" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Por frecuencia" sub="Clic para filtrar la tabla."><Donut data={byFreq} center={String(rows.length)} unit="controles" onSlice={(l) => toggleBar('freq', l)} active={barFilter?.dim === 'freq' ? barFilter.value : ''} /></Card>
        <Card title="Carga por responsable" sub="Clic para filtrar la tabla."><HBars data={byResp} onBar={(l) => toggleBar('resp', l)} active={barFilter?.dim === 'resp' ? barFilter.value : ''} /></Card>
        <OrgTopChart title="Controles" sub="Top 8 por nivel." items={controlItems} org={org} />
      </div>

      <div className="space-y-2">
        {noCubiertos > 0 && <Insight tone="warn">{noCubiertos} proceso(s) sin programa de auditoría. Los procesos críticos deberían tener al menos un punto de control.</Insight>}
        {sinEvidencia > 0 && <Insight tone="warn">{sinEvidencia} punto(s) sin evidencia definida. Sin evidencia, la auditoría no es verificable.</Insight>}
        {sinResp > 0 && <Insight tone="crit">{sinResp} punto(s) sin responsable asignado. Nadie los ejecutará hasta asignarlos.</Insight>}
      </div>

      {barFilter && (
        <div className="flex items-center gap-2 -mb-1">
          <span className="text-[11px] text-white/45">Tabla filtrada por {barFilter.dim === 'freq' ? 'frecuencia' : 'responsable'}:</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {barFilter.value}
            <button onClick={() => setBarFilter(null)} className="hover:text-white" title="Quitar filtro"><X size={12} /></button>
          </span>
        </div>
      )}
      <DataTable columns={columns} rows={shownRows} minWidth={1200} rowKey={(r, i) => `${r.process.id}-${i}`} />
    </Dashboard>
  )
}
