import { useState, useEffect } from 'react'
import { Trash2, CheckCircle2 } from 'lucide-react'
import {
  type ImprovementOpportunity, type ScoreValue, type ImprovementStatus, type ImprovementType,
  SCORE_VALUES, SCORE_LABELS, STATUS_LABELS, STATUS_OPTIONS,
  IMPROVEMENT_TYPE_OPTIONS, IMPROVEMENT_TYPE_LABELS,
  priorityScore, priorityLabel,
} from '@/types/improvement'
import { MilestoneChecklist } from './MilestoneChecklist'

interface Props {
  opportunity: ImprovementOpportunity
  onChange: (updates: Partial<ImprovementOpportunity>) => void
  onDelete: () => void
}

const PRIORITY_TONE = {
  high: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  mid: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-red-500/15 text-red-400 border-red-500/30',
} as const

export function ImprovementCard({ opportunity: o, onChange, onDelete }: Props) {
  // Buffers locales para texto — se comprometen en onBlur (evita un write por tecla).
  const [name, setName] = useState(o.name)
  const [description, setDescription] = useState(o.description)
  const [responsible, setResponsible] = useState(o.responsible)
  const [notes, setNotes] = useState(o.progressNotes)

  useEffect(() => { setName(o.name) }, [o.name])
  useEffect(() => { setDescription(o.description) }, [o.description])
  useEffect(() => { setResponsible(o.responsible) }, [o.responsible])
  useEffect(() => { setNotes(o.progressNotes) }, [o.progressNotes])

  const total = priorityScore(o)
  const prio = priorityLabel(total)

  const inputCls = 'w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/30 text-xs'
  const labelCls = 'block text-[9px] uppercase tracking-wide text-white/30 mb-1'

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-3">
      {/* Título + prioridad + borrar */}
      <div className="flex items-start gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== o.name && onChange({ name })}
          className="flex-1 bg-transparent border-b border-white/10 focus:border-cyan-500/40 focus:outline-none text-sm font-semibold text-white pb-1"
          placeholder="Nombre de la oportunidad"
        />
        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${PRIORITY_TONE[prio.tone]}`}>
          {prio.label} · {total}/15
        </span>
        <button type="button" onClick={onDelete} title="Eliminar" className="shrink-0 p-1 rounded text-white/25 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Descripción */}
      <div>
        <label className={labelCls}>Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== o.description && onChange({ description })}
          rows={3}
          className={inputCls + ' resize-y leading-relaxed'}
          placeholder="Descripción de la mejora (generada con IA o manual)"
        />
      </div>

      {/* Tipo de mejora (catálogo) */}
      <div>
        <label className={labelCls}>Tipo de mejora</label>
        <select
          value={o.type}
          onChange={(e) => onChange({ type: e.target.value as ImprovementType })}
          className={inputCls}
        >
          {IMPROVEMENT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t} className="bg-[#0a0f1a]">{IMPROVEMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Variables 1/3/5 */}
      <div className="grid grid-cols-3 gap-2">
        <ScoreSelector label="Costo" kind="cost" value={o.costScore} onSelect={(v) => onChange({ costScore: v })} />
        <ScoreSelector label="Complejidad" kind="complexity" value={o.complexityScore} onSelect={(v) => onChange({ complexityScore: v })} />
        <ScoreSelector label="Tiempo" kind="time" value={o.timeScore} onSelect={(v) => onChange({ timeScore: v })} />
      </div>

      {/* Plan de acción */}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className={labelCls}>Responsable</label>
          <input
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            onBlur={() => responsible !== o.responsible && onChange({ responsible })}
            className={inputCls}
            placeholder="Persona responsable"
          />
        </div>
        <div>
          <label className={labelCls}>Fecha inicio</label>
          <input type="date" value={o.startDate ?? ''} onChange={(e) => onChange({ startDate: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fecha fin</label>
          <input type="date" value={o.endDate ?? ''} onChange={(e) => onChange({ endDate: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Estado</label>
          <select value={o.status} onChange={(e) => onChange({ status: e.target.value as ImprovementStatus })} className={inputCls}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-[#0a0f1a]">{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Avance: {o.progressPct}%</label>
          <input type="range" min={0} max={100} step={5} value={o.progressPct} onChange={(e) => onChange({ progressPct: Number(e.target.value) })} className="w-full accent-cyan-500 mt-2" />
        </div>
      </div>

      {/* Notas de avance */}
      <div>
        <label className={labelCls}>Avance / comentarios</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== o.progressNotes && onChange({ progressNotes: notes })}
          rows={2}
          className={inputCls + ' resize-y'}
          placeholder="Registra aquí el avance del plan de acción..."
        />
      </div>

      {/* Hitos / subtareas */}
      <div>
        <label className={labelCls}>Hitos / subtareas</label>
        <MilestoneChecklist milestones={o.milestones} onChange={(milestones) => onChange({ milestones })} />
      </div>

      {/* Cierre */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        <div className="flex items-center gap-2">
          <label className={labelCls + ' !mb-0'}>Cierre</label>
          <input type="date" value={o.closeDate ?? ''} onChange={(e) => onChange({ closeDate: e.target.value || null })} className={inputCls + ' !w-auto'} />
        </div>
        <button
          type="button"
          onClick={() => onChange({
            status: 'cerrada',
            progressPct: 100,
            closeDate: o.closeDate ?? new Date().toISOString().slice(0, 10),
          })}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-[11px] font-medium"
        >
          <CheckCircle2 size={12} /> Marcar cerrada
        </button>
      </div>
    </div>
  )
}

function ScoreSelector({ label, kind, value, onSelect }: {
  label: string
  kind: 'cost' | 'complexity' | 'time'
  value: ScoreValue
  onSelect: (v: ScoreValue) => void
}) {
  return (
    <div>
      <label className="block text-[9px] uppercase tracking-wide text-white/30 mb-1">{label}</label>
      <div className="flex gap-1">
        {SCORE_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            title={SCORE_LABELS[kind][v]}
            className={`flex-1 px-1 py-1 rounded text-[10px] font-medium border transition-colors ${
              value === v
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-white/30 border-white/10 hover:bg-white/10'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-white/35 mt-0.5 text-center">{SCORE_LABELS[kind][value]}</p>
    </div>
  )
}
