import { useMemo, useState } from 'react'
import type { Process } from '@/types/process'
import {
  type ImprovementOpportunity, type ImprovementStatus,
  STATUS_LABELS, STATUS_OPTIONS, priorityScore, priorityLabel,
  IMPROVEMENT_TYPE_OPTIONS, IMPROVEMENT_TYPE_LABELS, IMPROVEMENT_TYPE_COLORS,
} from '@/types/improvement'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge,
  Th, Td, EmptyRow, VerMasRow, TableWrap, type Datum,
} from '../components/reportUi'
import { useVerMas } from '../components/reportPaging'
import { useOrgLabels } from '@/hooks/useOrgLabels'

// Reporte de Mejoras: tablero (estado, prioridad, avance, quick wins) + tabla
// de gestión editable (estado, avance %, fecha de cierre).

const STATUS_COLOR: Record<ImprovementStatus, string> = {
  propuesta: '#64748b', aprobada: '#06b6d4', en_progreso: '#f59e0b', cerrada: '#10b981', descartada: '#ef4444',
}
const PRIO_HEX: Record<'high' | 'mid' | 'low', string> = { high: '#10b981', mid: '#f59e0b', low: '#ef4444' }
const inputCls = 'bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/40'

export function ImprovementsReport({
  processes, allImprovements, onUpdate,
}: {
  processes: Process[]
  allImprovements: ImprovementOpportunity[]
  onUpdate: (id: string, updates: Partial<ImprovementOpportunity>) => void
}) {
  const org = useOrgLabels()
  const [fType, setFType] = useState('')
  const rows = useMemo(() => {
    const byProcess = new Set(processes.map((p) => p.id))
    const pMap = new Map(processes.map((p) => [p.id, p]))
    return allImprovements.filter((o) => byProcess.has(o.processId)).map((o) => ({ o, process: pMap.get(o.processId)! }))
  }, [processes, allImprovements])
  const opps = useMemo(() => rows.map((r) => r.o), [rows])
  const shownRows = useMemo(() => (fType ? rows.filter((r) => r.o.type === fType) : rows), [rows, fType])
  const { visibles, ocultas, verMas } = useVerMas(shownRows)

  const byType = useMemo<Datum[]>(() => IMPROVEMENT_TYPE_OPTIONS.map((t) => ({
    label: IMPROVEMENT_TYPE_LABELS[t], color: IMPROVEMENT_TYPE_COLORS[t], value: opps.filter((o) => o.type === t).length,
  })).filter((d) => d.value > 0), [opps])

  const byStatus = useMemo<Datum[]>(() => STATUS_OPTIONS.map((s) => ({
    label: STATUS_LABELS[s], color: STATUS_COLOR[s], value: opps.filter((o) => o.status === s).length,
  })).filter((d) => d.value > 0), [opps])
  const byPrio = useMemo<Datum[]>(() => {
    const buckets = { high: 0, mid: 0, low: 0 }
    opps.forEach((o) => { buckets[priorityLabel(priorityScore(o)).tone]++ })
    return [
      { label: 'Quick win', value: buckets.high, color: PRIO_HEX.high },
      { label: 'Media', value: buckets.mid, color: PRIO_HEX.mid },
      { label: 'Difícil', value: buckets.low, color: PRIO_HEX.low },
    ]
  }, [opps])
  const topProc = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    rows.forEach(({ process }) => m.set(process.name, (m.get(process.name) || 0) + 1))
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#8b5cf6' })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [rows])

  const abiertas = opps.filter((o) => o.status !== 'cerrada' && o.status !== 'descartada')
  const avgProgress = abiertas.length ? Math.round(abiertas.reduce((s, o) => s + (o.progressPct || 0), 0) / abiertas.length) : 0
  const cerradas = opps.filter((o) => o.status === 'cerrada').length
  const quickWins = opps.filter((o) => priorityLabel(priorityScore(o)).tone === 'high' && o.status !== 'cerrada' && o.status !== 'descartada').length

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Oportunidades" value={opps.length} sub={`${abiertas.length} abiertas`} tone="cyan" />
        <Stat label="Quick wins" value={quickWins} sub="alto impacto, bajo esfuerzo" tone="emerald" />
        <Stat label="Avance medio" value={`${avgProgress}%`} sub="de las abiertas" tone="amber" />
        <Stat label="Cerradas" value={cerradas} sub={`${opps.length ? Math.round(cerradas / opps.length * 100) : 0}% del total`} tone="violet" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Por tipo de mejora" sub="Catálogo. Clic para filtrar la tabla.">
          <Donut data={byType} center={String(opps.length)} unit="mejoras" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {IMPROVEMENT_TYPE_OPTIONS.map((t) => (
              <button key={t} onClick={() => setFType(fType === t ? '' : t)}
                className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${fType === t ? 'border-white/40 text-white' : 'border-white/10 text-white/50 hover:text-white/80'}`}>
                {IMPROVEMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Por estado" sub="Embudo de ejecución."><Donut data={byStatus} center={String(opps.length)} unit="mejoras" /></Card>
        <Card title="Por prioridad" sub="Costo + complejidad + tiempo."><HBars data={byPrio} /></Card>
        <Card title="Mejoras por proceso" sub="Top 8."><HBars data={topProc} /></Card>
      </div>

      <div className="space-y-2">
        {quickWins > 0 && <Insight tone="ok">{quickWins} quick win(s) abiertas: alto impacto y bajo esfuerzo. Ejecútalas primero para mostrar resultados rápidos.</Insight>}
        {abiertas.filter((o) => !o.responsible).length > 0 && <Insight tone="warn">{abiertas.filter((o) => !o.responsible).length} oportunidad(es) abiertas sin responsable. No avanzarán hasta asignarlas.</Insight>}
        {abiertas.filter((o) => o.status === 'en_progreso' && (o.progressPct || 0) === 0).length > 0 && <Insight tone="warn">{abiertas.filter((o) => o.status === 'en_progreso' && (o.progressPct || 0) === 0).length} mejora(s) marcadas "en progreso" con 0% de avance. Actualiza el estado o el porcentaje.</Insight>}
      </div>

      <TableWrap minWidth={1640}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            <Th>{org.l0}</Th><Th>Proceso</Th><Th>Oportunidad</Th><Th>Tipo</Th><Th>Prioridad</Th>
            <Th>Costo</Th><Th>Compl.</Th><Th>Tiempo</Th><Th>Responsable</Th>
            <Th>Inicio</Th><Th>Fin</Th><Th>Estado</Th><Th>Avance</Th><Th>Hitos</Th><Th>Notas</Th><Th>Cierre</Th>
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
                <Td><Badge label={IMPROVEMENT_TYPE_LABELS[o.type]} hex={IMPROVEMENT_TYPE_COLORS[o.type]} /></Td>
                <Td><Badge label={`${total}/15 · ${prio.label}`} hex={PRIO_HEX[prio.tone]} /></Td>
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
                  <input type="number" min={0} max={100} step={5} defaultValue={o.progressPct}
                    onBlur={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== o.progressPct) onUpdate(o.id, { progressPct: v }) }}
                    className={inputCls + ' w-14'} />
                  <span className="text-white/30 text-[10px]">%</span>
                </Td>
                <Td>{o.milestones.length ? `${o.milestones.filter((m) => m.done).length}/${o.milestones.length}` : <span className="text-white/20">—</span>}</Td>
                <Td className="max-w-[200px]"><div className="truncate" title={o.progressNotes}>{o.progressNotes || <span className="text-white/20">—</span>}</div></Td>
                <Td><input type="date" value={o.closeDate ?? ''} onChange={(e) => onUpdate(o.id, { closeDate: e.target.value || null })} className={inputCls} /></Td>
              </tr>
            )
          })}
          {shownRows.length === 0 && <EmptyRow cols={16} />}
          <VerMasRow cols={16} ocultas={ocultas} onVerMas={verMas} />
        </tbody>
      </TableWrap>
    </Dashboard>
  )
}
