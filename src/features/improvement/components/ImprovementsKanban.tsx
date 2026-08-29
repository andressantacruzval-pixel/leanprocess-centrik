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
  propuesta:   { bar: 'bg-slate-400/60',  chip: 'bg-slate-500/15 text-gray-500' },
  aprobada:    { bar: 'bg-blue-100',   chip: 'bg-blue-50 text-blue-700' },
  en_progreso: { bar: 'bg-amber-100',  chip: 'bg-amber-50 text-amber-700' },
  cerrada:     { bar: 'bg-emerald-100',chip: 'bg-emerald-50 text-emerald-700' },
  descartada:  { bar: 'bg-red-100',    chip: 'bg-red-50 text-red-700' },
}

const PRIO_TONE = {
  high: 'bg-emerald-50 text-emerald-600',
  mid: 'bg-amber-50 text-amber-600',
  low: 'bg-red-50 text-red-600',
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
            className={`w-[280px] shrink-0 rounded-lg border bg-gray-50 flex flex-col transition-colors ${
              overCol === status ? 'border-primary-300 bg-primary-50' : 'border-gray-100'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${tone.bar}`} />
                <span className="text-xs font-semibold text-gray-900">{STATUS_LABELS[status]}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${tone.chip}`}>{items.length}</span>
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
                <div className="text-center text-[10px] text-gray-300 py-6">Suelta tarjetas aquí</div>
              )}
            </div>
          </div>
        )
      })}
    </div>

    {expanded && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4"
        onClick={() => setExpandedId(null)}
      >
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">Oportunidad de mejora</h3>
              <p className="text-[10px] text-gray-500 truncate">{processNameById.get(expanded.processId) ?? ''}</p>
            </div>
            <button onClick={() => setExpandedId(null)} className="p-1 rounded-md hover:bg-gray-50 text-gray-500 hover:text-gray-700">
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
      className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        <GripVertical size={12} className="text-gray-300 mt-0.5 shrink-0" />
        <p className="flex-1 text-xs font-medium text-gray-900 leading-snug">{o.name}</p>
        <span className={`shrink-0 text-[8px] px-1 py-0.5 rounded-md ${PRIO_TONE[prio.tone]}`}>{total}</span>
        <button
          type="button"
          onClick={onExpand}
          onMouseDown={(e) => e.stopPropagation()}
          title="Ampliar / ver todo"
          className="shrink-0 p-0.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-gray-50"
        >
          <Maximize2 size={12} />
        </button>
      </div>

      {processName && <p className="text-[9px] text-gray-400 pl-4 truncate">{processName}</p>}

      {o.responsible && (
        <div className="flex items-center gap-1 pl-4 text-[10px] text-gray-500">
          <User size={10} /> {o.responsible}
        </div>
      )}

      {/* Progreso */}
      <div className="pl-4">
        <div className="h-1 rounded-full bg-gray-50 overflow-hidden">
          <div className="h-full rounded-full bg-primary-100" style={{ width: `${o.progressPct}%` }} />
        </div>
      </div>

      {/* Checklist de hitos (compartido) */}
      <div className="pl-4">
        <MilestoneChecklist milestones={o.milestones} onChange={(ms) => onUpdate({ milestones: ms })} />
      </div>
    </div>
  )
}
