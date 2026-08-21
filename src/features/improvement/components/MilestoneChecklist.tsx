import { useState } from 'react'
import { Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { generateId } from '@/utils/id'
import type { ImprovementMilestone } from '@/types/improvement'

interface Props {
  milestones: ImprovementMilestone[]
  onChange: (milestones: ImprovementMilestone[]) => void
}

/** Checklist de hitos/subtareas delegables (tipo Trello). Reutilizable. */
export function MilestoneChecklist({ milestones, onChange }: Props) {
  const [title, setTitle] = useState('')
  const [resp, setResp] = useState('')
  const done = milestones.filter((m) => m.done).length

  const add = () => {
    if (!title.trim()) return
    onChange([...milestones, { id: generateId(), title: title.trim(), responsible: resp.trim(), done: false }])
    setTitle(''); setResp('')
  }
  const toggle = (id: string) => onChange(milestones.map((m) => (m.id === id ? { ...m, done: !m.done } : m)))
  const remove = (id: string) => onChange(milestones.filter((m) => m.id !== id))
  const editResp = (id: string, responsible: string) => onChange(milestones.map((m) => (m.id === id ? { ...m, responsible } : m)))

  return (
    <div className="space-y-1">
      {milestones.length > 0 && (
        <p className="text-[9px] text-white/30 uppercase tracking-wide">Hitos {done}/{milestones.length}</p>
      )}
      {milestones.map((m) => (
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
      <div className="flex items-center gap-1 pt-0.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="+ hito / subtarea"
          className="flex-1 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        />
        <input
          value={resp}
          onChange={(e) => setResp(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="quién"
          className="w-14 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        />
        <button type="button" onClick={add} className="shrink-0 p-1 rounded bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25">
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}
