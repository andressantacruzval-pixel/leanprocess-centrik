import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Process } from '@/types/process'
import {
  type ImprovementOpportunity, type ImprovementStatus,
  STATUS_LABELS, STATUS_OPTIONS, priorityScore, priorityLabel,
  IMPROVEMENT_TYPE_OPTIONS, IMPROVEMENT_TYPE_LABELS, IMPROVEMENT_TYPE_COLORS,
} from '@/types/improvement'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, type Datum,
} from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { OrgTopChart, type OrgTopItem } from '../components/OrgTopChart'
import { useOrgLabels } from '@/hooks/useOrgLabels'

type ImpRow = { o: ImprovementOpportunity; process: Process }

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
  const [fStatus, setFStatus] = useState<ImprovementStatus | ''>('')
  const [fPrio, setFPrio] = useState<'high' | 'mid' | 'low' | ''>('')
  const statusByLabel = useMemo(() => Object.fromEntries(STATUS_OPTIONS.map((s) => [STATUS_LABELS[s], s])) as Record<string, ImprovementStatus>, [])
  const prioByLabel: Record<string, 'high' | 'mid' | 'low'> = { 'Quick win': 'high', Media: 'mid', Difícil: 'low' }
  const shownRows = useMemo(() => rows.filter((r) =>
    (!fType || r.o.type === fType) &&
    (!fStatus || r.o.status === fStatus) &&
    (!fPrio || priorityLabel(priorityScore(r.o)).tone === fPrio)
  ), [rows, fType, fStatus, fPrio])
  const statusActiveLabel = fStatus ? STATUS_LABELS[fStatus] : ''
  const prioActiveLabel = fPrio === 'high' ? 'Quick win' : fPrio === 'mid' ? 'Media' : fPrio === 'low' ? 'Difícil' : ''

  const columns = useMemo<Column<ImpRow>[]>(() => [
    { key: 'l0', header: org.l0, accessor: (r) => r.process.management || '' },
    { key: 'proc', header: 'Proceso', accessor: (r) => r.process.name || '', className: 'max-w-[150px]', cell: (r) => <div className="truncate">{r.process.name}</div> },
    {
      key: 'opp', header: 'Oportunidad', accessor: (r) => r.o.name || '', className: 'text-white font-medium max-w-[240px]',
      cell: (r) => (<><div className="truncate" title={r.o.name}>{r.o.name}</div><div className="text-white/30 text-[10px] truncate" title={r.o.description}>{r.o.description}</div></>),
    },
    { key: 'type', header: 'Tipo', accessor: (r) => IMPROVEMENT_TYPE_LABELS[r.o.type], cell: (r) => <Badge label={IMPROVEMENT_TYPE_LABELS[r.o.type]} hex={IMPROVEMENT_TYPE_COLORS[r.o.type]} /> },
    { key: 'prio', header: 'Prioridad', accessor: (r) => priorityScore(r.o), cell: (r) => { const total = priorityScore(r.o); const prio = priorityLabel(total); return <Badge label={`${total}/15 · ${prio.label}`} hex={PRIO_HEX[prio.tone]} /> } },
    { key: 'cost', header: 'Costo', accessor: (r) => r.o.costScore },
    { key: 'compl', header: 'Compl.', accessor: (r) => r.o.complexityScore },
    { key: 'time', header: 'Tiempo', accessor: (r) => r.o.timeScore },
    { key: 'resp', header: 'Responsable', accessor: (r) => r.o.responsible || '', className: 'max-w-[120px]', cell: (r) => <div className="truncate">{r.o.responsible || '-'}</div> },
    { key: 'start', header: 'Inicio', accessor: (r) => r.o.startDate || '', cell: (r) => r.o.startDate || '-' },
    { key: 'end', header: 'Fin', accessor: (r) => r.o.endDate || '', cell: (r) => r.o.endDate || '-' },
    {
      key: 'status', header: 'Estado', accessor: (r) => STATUS_LABELS[r.o.status],
      cell: (r) => (<select value={r.o.status} onChange={(e) => onUpdate(r.o.id, { status: e.target.value as ImprovementStatus })} className={inputCls}>{STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-[#0a0f1a]">{STATUS_LABELS[s]}</option>)}</select>),
    },
    {
      key: 'progress', header: 'Avance', accessor: (r) => r.o.progressPct || 0, filterable: false,
      cell: (r) => (<><input type="number" min={0} max={100} step={5} defaultValue={r.o.progressPct} onBlur={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); if (v !== r.o.progressPct) onUpdate(r.o.id, { progressPct: v }) }} className={inputCls + ' w-14'} /><span className="text-white/30 text-[10px]">%</span></>),
    },
    { key: 'milestones', header: 'Hitos', accessor: (r) => r.o.milestones.length, cell: (r) => r.o.milestones.length ? `${r.o.milestones.filter((m) => m.done).length}/${r.o.milestones.length}` : <span className="text-white/20">—</span> },
    { key: 'notes', header: 'Notas', accessor: (r) => r.o.progressNotes || '', className: 'max-w-[200px]', cell: (r) => <div className="truncate" title={r.o.progressNotes}>{r.o.progressNotes || <span className="text-white/20">—</span>}</div> },
    {
      key: 'close', header: 'Cierre', accessor: (r) => r.o.closeDate || '', filterable: false,
      cell: (r) => <input type="date" value={r.o.closeDate ?? ''} onChange={(e) => onUpdate(r.o.id, { closeDate: e.target.value || null })} className={inputCls} />,
    },
  ], [org, onUpdate])

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
  const oppItems = useMemo<OrgTopItem[]>(() => rows.map(({ process }) => ({
    management: process.management, coordination: process.coordination, operative: process.operative, process: process.name,
  })), [rows])

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
        <Card title="Por estado" sub="Clic para filtrar la tabla."><Donut data={byStatus} center={String(opps.length)} unit="mejoras" onSlice={(l) => setFStatus(statusActiveLabel === l ? '' : (statusByLabel[l] ?? ''))} active={statusActiveLabel} /></Card>
        <Card title="Por prioridad" sub="Clic para filtrar la tabla."><HBars data={byPrio} onBar={(l) => setFPrio(prioActiveLabel === l ? '' : (prioByLabel[l] ?? ''))} active={prioActiveLabel} /></Card>
        <OrgTopChart title="Mejoras" sub="Top 8 por nivel." items={oppItems} org={org} color="#8b5cf6" />
      </div>

      <div className="space-y-2">
        {quickWins > 0 && <Insight tone="ok">{quickWins} quick win(s) abiertas: alto impacto y bajo esfuerzo. Ejecútalas primero para mostrar resultados rápidos.</Insight>}
        {abiertas.filter((o) => !o.responsible).length > 0 && <Insight tone="warn">{abiertas.filter((o) => !o.responsible).length} oportunidad(es) abiertas sin responsable. No avanzarán hasta asignarlas.</Insight>}
        {abiertas.filter((o) => o.status === 'en_progreso' && (o.progressPct || 0) === 0).length > 0 && <Insight tone="warn">{abiertas.filter((o) => o.status === 'en_progreso' && (o.progressPct || 0) === 0).length} mejora(s) marcadas "en progreso" con 0% de avance. Actualiza el estado o el porcentaje.</Insight>}
      </div>

      {(fStatus || fPrio) && (
        <div className="flex items-center gap-2 flex-wrap -mb-1">
          <span className="text-[11px] text-white/45">Tabla filtrada:</span>
          {fStatus && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Estado: {statusActiveLabel}
              <button onClick={() => setFStatus('')} className="hover:text-white" title="Quitar filtro"><X size={12} /></button>
            </span>
          )}
          {fPrio && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Prioridad: {prioActiveLabel}
              <button onClick={() => setFPrio('')} className="hover:text-white" title="Quitar filtro"><X size={12} /></button>
            </span>
          )}
        </div>
      )}
      <DataTable columns={columns} rows={shownRows} minWidth={1640} rowKey={(r) => r.o.id} />
    </Dashboard>
  )
}
