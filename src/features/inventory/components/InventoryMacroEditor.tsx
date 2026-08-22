import { useState, useMemo } from 'react'
import { Pencil, Trash2, Plus, Check, X, CheckCheck, Upload, Loader2, MapPin } from 'lucide-react'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useProcessStore } from '@/stores/processStore'
import { volcarSubAlMapa, subEnMapa } from '../volcarAlMapa'
import type { InvMacro, InvSub } from '../types'
import { OriginBadge } from './OriginBadge'

// Editor en vivo de un macroproceso: agregar / editar / eliminar / aceptar
// procesos y subprocesos. La aceptación (deducido → aceptado) es por subproceso.

interface Props {
  companyId: string
  macro: InvMacro
  mi: number
  areas: string[]
}

export function InventoryMacroEditor({ companyId, macro, mi, areas }: Props) {
  const addProceso = useInventoryStore((s) => s.addProceso)
  const [newProc, setNewProc] = useState('')

  if (!macro.procesos.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
        <p className="text-sm text-white/50">Este macroproceso aún no tiene procesos.</p>
        <p className="text-xs text-white/30 mt-1">Usa Big Bang o Incremental arriba, o agrégalos a mano.</p>
        <AddProcInput value={newProc} onChange={setNewProc} onAdd={() => { if (newProc.trim()) { addProceso(companyId, mi, newProc.trim()); setNewProc('') } }} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {macro.procesos.map((p, pi) => (
        <ProcCard key={pi} companyId={companyId} mi={mi} pi={pi} nombre={p.nombre} subs={p.subprocesos} areas={areas} />
      ))}
      <AddProcInput value={newProc} onChange={setNewProc} onAdd={() => { if (newProc.trim()) { addProceso(companyId, mi, newProc.trim()); setNewProc('') } }} />
    </div>
  )
}

function AddProcInput({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }}
        placeholder="Nuevo proceso…" className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
      <button onClick={onAdd} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[12px] hover:bg-cyan-500/15"><Plus size={13} /> Proceso</button>
    </div>
  )
}

function ProcCard({ companyId, mi, pi, nombre, subs, areas }: { companyId: string; mi: number; pi: number; nombre: string; subs: InvSub[]; areas: string[] }) {
  const editProceso = useInventoryStore((s) => s.editProceso)
  const removeProceso = useInventoryStore((s) => s.removeProceso)
  const addSub = useInventoryStore((s) => s.addSub)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(nombre)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 mb-2">
        {editing ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-2 py-1 rounded bg-white/5 border border-cyan-500/40 text-[13px] text-white focus:outline-none" autoFocus />
            <IconBtn title="Guardar" onClick={() => { editProceso(companyId, mi, pi, name.trim() || nombre); setEditing(false) }}><Check size={14} /></IconBtn>
            <IconBtn title="Cancelar" onClick={() => { setName(nombre); setEditing(false) }}><X size={14} /></IconBtn>
          </>
        ) : (
          <>
            <div className="flex-1 text-[13px] font-medium text-cyan-300">{nombre}</div>
            <IconBtn title="Editar proceso" onClick={() => setEditing(true)}><Pencil size={13} /></IconBtn>
            <IconBtn title="Eliminar proceso" danger onClick={() => { if (confirm(`¿Eliminar el proceso «${nombre}» y sus subprocesos?`)) removeProceso(companyId, mi, pi) }}><Trash2 size={13} /></IconBtn>
          </>
        )}
      </div>
      <div className="space-y-1.5">
        {subs.map((s, si) => <SubRow key={si} companyId={companyId} mi={mi} pi={pi} si={si} sub={s} areas={areas} />)}
      </div>
      <button onClick={() => addSub(companyId, mi, pi, { nombre: 'Nuevo subproceso', area: '', objetivo: '', origen: 'confirmado' })}
        className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-cyan-300"><Plus size={12} /> Agregar subproceso</button>
    </div>
  )
}

function SubRow({ companyId, mi, pi, si, sub, areas }: { companyId: string; mi: number; pi: number; si: number; sub: InvSub; areas: string[] }) {
  const editSub = useInventoryStore((s) => s.editSub)
  const removeSub = useInventoryStore((s) => s.removeSub)
  // Suscribe a processes para recalcular "ya en el mapa" tras volcar uno a uno.
  const processes = useProcessStore((s) => s.processes)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<InvSub>(sub)
  const [volcandoUno, setVolcandoUno] = useState(false)
  // `processes`/`sub` fuerzan el recálculo: subEnMapa lee estado global y el
  // linter no lo detecta, pero el dato debe reflejar el volcado en vivo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const enMapa = useMemo(() => subEnMapa(companyId, mi, pi, si), [companyId, mi, pi, si, sub, processes])

  if (editing) {
    return (
      <div className="rounded-lg bg-white/[0.04] border border-cyan-500/30 p-2.5 space-y-2">
        <input value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Nombre del subproceso"
          className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12.5px] text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" autoFocus />
        <div className="flex gap-2">
          <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}
            className="flex-1 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
            <option value="">(sin área)</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={draft.origen} onChange={(e) => setDraft({ ...draft, origen: e.target.value as InvSub['origen'] })}
            className="px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
            <option value="deducido">Deducido</option>
            <option value="confirmado">Aceptado</option>
          </select>
        </div>
        <textarea value={draft.objetivo} onChange={(e) => setDraft({ ...draft, objetivo: e.target.value })} placeholder="Objetivo (verbo + qué + para qué)" rows={2}
          className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[12px] text-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
        <div className="flex gap-2">
          <button onClick={() => { editSub(companyId, mi, pi, si, draft); setEditing(false) }} className="inline-flex items-center gap-1 px-3 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[12px]"><Check size={13} /> Guardar</button>
          <button onClick={() => { setDraft(sub); setEditing(false) }} className="inline-flex items-center gap-1 px-3 py-1 rounded border border-white/10 text-white/50 text-[12px]"><X size={13} /> Cancelar</button>
        </div>
      </div>
    )
  }

  const accepted = sub.origen === 'confirmado'
  return (
    <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 bg-white/[0.03] border border-white/5 group">
      <button title={accepted ? 'Aceptado — clic para volver a deducido' : 'Deducido por IA — clic para aceptar'} onClick={() => editSub(companyId, mi, pi, si, { origen: accepted ? 'deducido' : 'confirmado' })} className="mt-0.5 shrink-0">
        <OriginBadge origen={sub.origen} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-white/85 leading-snug">{sub.nombre}</div>
        {sub.objetivo && <div className="text-[11px] text-white/40 mt-0.5 leading-snug">{sub.objetivo}</div>}
      </div>
      {sub.area && <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{sub.area}</span>}
      {enMapa && <span title="Ya está en el mapa de procesos" className="shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"><MapPin size={10} /> en el mapa</span>}
      <div className="shrink-0 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
        {!accepted && <IconBtn title="Aceptar" onClick={() => editSub(companyId, mi, pi, si, { origen: 'confirmado' })}><CheckCheck size={13} /></IconBtn>}
        {accepted && !enMapa && (
          <IconBtn title="Volcar este subproceso al mapa" onClick={async () => { if (volcandoUno) return; setVolcandoUno(true); try { await volcarSubAlMapa(companyId, mi, pi, si) } finally { setVolcandoUno(false) } }}>
            {volcandoUno ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          </IconBtn>
        )}
        <IconBtn title="Editar" onClick={() => setEditing(true)}><Pencil size={12} /></IconBtn>
        <IconBtn title="Eliminar" danger onClick={() => removeSub(companyId, mi, pi, si)}><Trash2 size={12} /></IconBtn>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`shrink-0 p-1.5 rounded-md text-white/40 hover:bg-white/5 transition-colors ${danger ? 'hover:text-red-300' : 'hover:text-cyan-300'}`}>{children}</button>
  )
}
