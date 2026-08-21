import { useState, useMemo } from 'react'
import { Plus, Trash2, User, GripVertical, CheckSquare, Square } from 'lucide-react'
import { generateId } from '@/utils/id'
import {
  type ImprovementOpportunity, type ImprovementMilestone, type ImprovementStatus,
  STATUS_LABELS, STATUS_OPTIONS, priorityScore, priorityLabel,
} from '@/types/improvement'

interface Props {
  opportunities: ImprovementOpportunity[]
  processNameById: Map<string, string>
  onUpdate: (id: string, updates: Partial<ImprovementOpportunity>) => void
}

const COLUMN_TONE: Record<ImprovementStatus, { bar: string; chip: string }> = {
  propuesta:   { bar: 'bg-slate-400/60',  chip: 'bg-slate-500/15 text-slate-300' },
  aprobada:    { bar: 'bg-blue-400/70',   chip: 'bg-blue-500/15 text-blue-300' },
  en_progreso: { bar: 'bg-amber-400/70',  chip: 'bg-amber-500/15 text-amber-300' },
  cerrada:     { bar: 'bg-emerald-400/70',chip: 'bg-emerald-500/15 text-emerald-300' },
  descartada:  { bar: 'bg-red-400/60',    chip: 'bg-red-500/15 text-red-300' },
}

const PRIO_TONE = {
  high: 'bg-emerald-500/15 text-emerald-400',
  mid: 'bg-amber-500/15 text-amber-400',
  low: 'bg-red-500/15 text-red-400',
} as const

export function ImprovementsKanban({ opportunities, processNameById, onUpdate }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ImprovementStatus | null>(null)

  const byStatus = useMemo(() => {
    const map: Record<ImprovementStatus, ImprovementOpportunity[]> = {
      propuesta: [], aprobada: [], en_progreso: [], cerrada: [], descartada: [],
    }
    for (const o of opportunities) (map[o.status] ?? map.propuesta).push(o)
    return map
  }, [opportunities])

  const drop = (status: ImprovementStatus) => {
    setOverCol(null)
    if (!dragId) return
    const o = opportunities.find((x) => x.id === dragId)
    setDragId(null)
    if (o && o.status !== status) {
      const patch: Partial<ImprovementOpportunity> = { status }
      if (status === 'cerrada') {
        patch.progressPct = 100
        patch.closeDate = o.closeDate ?? new Date().toISOString().slice(0, 10)
      }
      onUpdate(o.id, patch)
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
      {STATUS_OPTIONS.map((status) => {
        const items = byStatus[status]
        const tone = COLUMN_TONE[status]
        return (
          <div
            key={status}
            onDragOver={(e) => { e.preventDefault(); setOverCol(status) }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={() => drop(status)}
            className={`w-[280px] shrink-0 rounded-xl border bg-white/[0.02] flex flex-col transition-colors ${
              overCol === status ? 'border-cyan-500/40 bg-cyan-500/[0.04]' : 'border-white/5'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tone.bar}`} />
                <span className="text-xs font-semibold text-white">{STATUS_LABELS[status]}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${tone.chip}`}>{items.length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin">
              {items.map((o) => (
                <KanbanCard
                  key={o.id}
                  o={o}
                  processName={processNameById.get(o.processId) ?? ''}
                  onDragStart={() => setDragId(o.id)}
                  onUpdate={(u) => onUpdate(o.id, u)}
                />
              ))}
              {items.length === 0 && (
                <div className="text-center text-[10px] text-white/20 py-6">Suelta tarjetas aquí</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ o, processName, onDragStart, onUpdate }: {
  o: ImprovementOpportunity
  processName: string
  onDragStart: () => void
  onUpdate: (updates: Partial<ImprovementOpportunity>) => void
}) {
  const [newTitle, setNewTitle] = useState('')
  const [newResp, setNewResp] = useState('')
  const total = priorityScore(o)
  const prio = priorityLabel(total)
  const done = o.milestones.filter((m) => m.done).length

  const setMilestones = (ms: ImprovementMilestone[]) => onUpdate({ milestones: ms })
  const addMilestone = () => {
    if (!newTitle.trim()) return
    setMilestones([...o.milestones, { id: generateId(), title: newTitle.trim(), responsible: newResp.trim(), done: false }])
    setNewTitle(''); setNewResp('')
  }
  const toggle = (id: string) => setMilestones(o.milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m)))
  const remove = (id: string) => setMilestones(o.milestones.filter((m) => m.id !== id))
  const editResp = (id: string, responsible: string) => setMilestones(o.milestones.map((m) => (m.id === id ? { ...m, responsible } : m)))

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-lg border border-white/10 bg-[#0d1320] p-2.5 space-y-2 cursor-grab active:cursor-grabbing hover:border-white/20 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <GripVertical size={12} className="text-white/20 mt-0.5 shrink-0" />
        <p className="flex-1 text-xs font-medium text-white leading-snug">{o.name}</p>
        <span className={`shrink-0 text-[8px] px-1 py-0.5 rounded ${PRIO_TONE[prio.tone]}`}>{total}</span>
      </div>

      {processName && <p className="text-[9px] text-white/30 pl-4 truncate">{processName}</p>}

      {o.responsible && (
        <div className="flex items-center gap-1 pl-4 text-[10px] text-white/45">
          <User size={10} /> {o.responsible}
        </div>
      )}

      {/* Progreso */}
      <div className="pl-4">
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${o.progressPct}%` }} />
        </div>
      </div>

      {/* Checklist de hitos */}
      <div className="pl-4 space-y-1">
        {o.milestones.length > 0 && (
          <p className="text-[9px] text-white/30 uppercase tracking-wide">Hitos {done}/{o.milestones.length}</p>
        )}
        {o.milestones.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5 group">
            <button type="button" onClick={() => toggle(m.id)} className="shrink-0 text-white/40 hover:text-cyan-400">
              {m.done ? <CheckSquare size={13} className="text-emerald-400" /> : <Square size={13} />}
            </button>
            <span className={`flex-1 text-[11px] leading-tight ${m.done ? 'line-through text-white/30' : 'text-white/80'}`}>{m.title}</span>
            <input
              defaultValue={m.responsible}
              onBlur={(e) => e.target.value !== m.responsible && editResp(m.id, e.target.value)}
              placeholder="Delegar"
              className="w-16 bg-transparent text-[9px] text-white/40 border-b border-transparent hover:border-white/10 focus:border-cyan-500/40 focus:outline-none"
            />
            <button type="button" onClick={() => remove(m.id)} className="shrink-0 text-white/15 group-hover:text-red-400">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {/* Añadir hito */}
        <div className="flex items-center gap-1 pt-0.5">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMilestone() }}
            placeholder="+ hito / subtarea"
            className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          />
          <input
            value={newResp}
            onChange={(e) => setNewResp(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addMilestone() }}
            placeholder="quién"
            className="w-14 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          />
          <button type="button" onClick={addMilestone} className="shrink-0 p-1 rounded bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25">
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
