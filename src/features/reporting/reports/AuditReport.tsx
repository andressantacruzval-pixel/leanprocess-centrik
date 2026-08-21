import { useMemo } from 'react'
import type { Process } from '@/types/process'
import type { AuditItem } from '@/lib/procedureAi'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight,
  Th, Td, EmptyRow, VerMasRow, TableWrap, type Datum,
} from '../components/reportUi'
import { useVerMas } from '../components/reportPaging'

// Reporte de Programa de Auditoría: tablero (cobertura, carga por responsable,
// frecuencias, calidad del criterio) + tabla completa de puntos de control.

const FREQ_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']

export function AuditReport({ processes, allAudits }: { processes: Process[]; allAudits: Record<string, AuditItem[]> }) {
  const rows = useMemo(() => {
    const out: { process: Process; item: AuditItem }[] = []
    for (const p of processes) for (const item of (allAudits[p.id] || [])) out.push({ process: p, item })
    return out
  }, [processes, allAudits])
  const { visibles, ocultas, verMas } = useVerMas(rows)

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
  const byProc = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    rows.forEach(({ process }) => m.set(process.name, (m.get(process.name) || 0) + 1))
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#06b6d4' })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [rows])

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
        <Card title="Por frecuencia" sub="Cadencia de auditoría."><Donut data={byFreq} center={String(rows.length)} unit="controles" /></Card>
        <Card title="Carga por responsable" sub="Top 8 auditores."><HBars data={byResp} /></Card>
        <Card title="Controles por proceso" sub="Top 8 más auditados."><HBars data={byProc} /></Card>
      </div>

      <div className="space-y-2">
        {noCubiertos > 0 && <Insight tone="warn">{noCubiertos} proceso(s) sin programa de auditoría. Los procesos críticos deberían tener al menos un punto de control.</Insight>}
        {sinEvidencia > 0 && <Insight tone="warn">{sinEvidencia} punto(s) sin evidencia definida. Sin evidencia, la auditoría no es verificable.</Insight>}
        {sinResp > 0 && <Insight tone="crit">{sinResp} punto(s) sin responsable asignado. Nadie los ejecutará hasta asignarlos.</Insight>}
      </div>

      <TableWrap minWidth={1200}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            <Th>Gerencia</Th><Th>Área</Th><Th>Proceso</Th><Th>Actividad</Th>
            <Th>Qué auditar</Th><Th>Criterio</Th><Th>Evidencia</Th><Th>Frecuencia</Th><Th>Responsable</Th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((row, i) => (
            <tr key={`${row.process.id}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors align-top">
              <Td>{row.process.management || '-'}</Td>
              <Td>{row.process.coordination || '-'}</Td>
              <Td className="max-w-[150px]"><div className="truncate">{row.process.name}</div></Td>
              <Td className="max-w-[200px]"><div className="truncate" title={row.item.actividad}>{row.item.actividad}</div></Td>
              <Td className="text-white font-medium max-w-[200px]"><div className="truncate" title={row.item.queAuditar}>{row.item.queAuditar}</div></Td>
              <Td className="max-w-[180px]"><div className="truncate" title={row.item.criterio}>{row.item.criterio}</div></Td>
              <Td className="max-w-[160px]"><div className="truncate" title={row.item.evidencia}>{row.item.evidencia}</div></Td>
              <Td>{row.item.frecuencia}</Td>
              <Td className="max-w-[130px]"><div className="truncate">{row.item.responsable}</div></Td>
            </tr>
          ))}
          {rows.length === 0 && <EmptyRow cols={9} />}
          <VerMasRow cols={9} ocultas={ocultas} onVerMas={verMas} />
        </tbody>
      </TableWrap>
    </Dashboard>
  )
}
