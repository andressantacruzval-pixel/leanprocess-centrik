import { useState, useMemo } from 'react'
import { User, GripVertical, Maximize2, X } from 'lucide-react'
import {
  type ImprovementOpportunity, type ImprovementStatus,
  STATUS_LABELS, STATUS_OPTIONS, priorityScore, priorityLabel,
} from '@/types/improvement'
import { MilestoneChecklist } from './MilestoneChecklist'
import { ImprovementCard } from './ImprovementCard'

interface Props {
  opportunities: ImprovementOpportunity[]
  processNameById: Map<string, string>
  onUpdate: (id: string, updates: Partial<ImprovementOpportunity>) => void
  onDelete?: (id: string) => void
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

export function ImprovementsKanban({ opportunities, processNameById, onUpdate, onDelete }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ImprovementStatus | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const expanded = expandedId ? opportunities.find((o) => o.id === expandedId) ?? null : null

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
    <>
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
                  onExpand={() => setExpandedId(o.id)}
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

    {expanded && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={() => setExpandedId(null)}
      >
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0f1a] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 sticky top-0 bg-[#0a0f1a] z-10">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">Oportunidad de mejora</h3>
              <p className="text-[10px] text-white/40 truncate">{processNameById.get(expanded.processId) ?? ''}</p>
            </div>
            <button onClick={() => setExpandedId(null)} className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70">
              <X size={16} />
            </button>
          </div>
          <div className="p-4">
            <ImprovementCard
              opportunity={expanded}
              onChange={(u) => onUpdate(expanded.id, u)}
              onDelete={() => {
                if (onDelete) onDelete(expanded.id)
                else onUpdate(expanded.id, { status: 'descartada' })
                setExpandedId(null)
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function KanbanCard({ o, processName, onDragStart, onUpdate, onExpand }: {
  o: ImprovementOpportunity
  processName: string
  onDragStart: () => void
  onUpdate: (updates: Partial<ImprovementOpportunity>) => void
  onExpand: () => void
}) {
  const total = priorityScore(o)
  const prio = priorityLabel(total)

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
        <button
          type="button"
          onClick={onExpand}
          onMouseDown={(e) => e.stopPropagation()}
          title="Ampliar / ver todo"
          className="shrink-0 p-0.5 rounded text-white/30 hover:text-cyan-400 hover:bg-white/5"
        >
          <Maximize2 size={12} />
        </button>
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

      {/* Checklist de hitos (compartido) */}
      <div className="pl-4">
        <MilestoneChecklist milestones={o.milestones} onChange={(ms) => onUpdate({ milestones: ms })} />
      </div>
    </div>
  )
}
