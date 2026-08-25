import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, ArrowLeft, Columns3 } from 'lucide-react'
import type { AssetColumn } from '@/types/asset'

interface Props {
  assetName: string
  columns: AssetColumn[]
  targetName: string
  fixedDirection?: 'to' | 'from'
  initialSelected?: string[]
  initialJustification?: string
  onConfirm: (direction: 'to' | 'from', columns: AssetColumn[], justification: string) => void
  onClose: () => void
}

// Detalle de la conexión de un activo con un subproceso: dirección (sale hacia /
// entra desde), qué columnas del activo viajan (minimización de datos) y una
// justificación. El contador ayuda a enviar solo lo necesario.
export function JourneyLinkModal({ assetName, columns, targetName, fixedDirection, initialSelected, initialJustification, onConfirm, onClose }: Props) {
  const [direction, setDirection] = useState<'to' | 'from'>(fixedDirection ?? 'to')
  const [picked, setPicked] = useState<Set<string>>(new Set(initialSelected ?? columns.map((c) => c.name)))
  const [justification, setJustification] = useState(initialJustification ?? '')

  const toggle = (name: string) => setPicked((p) => { const n = new Set(p); if (n.has(name)) n.delete(name); else n.add(name); return n })
  const selected = columns.filter((c) => picked.has(c.name))

  const dirBtn = (active: boolean) => `flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${active ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1420] rounded-2xl shadow-xl w-full max-w-lg mx-4 border border-white/10 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2"><Columns3 size={16} className="text-cyan-400" /><h3 className="text-sm font-semibold text-white">Conectar activo con subproceso</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-[12px] text-white/60"><span className="text-white font-medium">{assetName}</span> ↔ <span className="text-white font-medium">{targetName}</span></p>

          {!fixedDirection && (
            <div>
              <label className="block text-[10px] font-medium text-white/50 mb-1.5 uppercase tracking-wide">Dirección</label>
              <div className="flex gap-2">
                <button onClick={() => setDirection('to')} className={dirBtn(direction === 'to')}><ArrowRight size={13} /> Sale hacia {targetName}</button>
                <button onClick={() => setDirection('from')} className={dirBtn(direction === 'from')}><ArrowLeft size={13} /> Entra desde {targetName}</button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium text-white/50 uppercase tracking-wide">Columnas que viajan</label>
              <span className="text-[10px] text-cyan-300 font-medium">{selected.length} de {columns.length}</span>
            </div>
            {columns.length === 0 ? (
              <p className="text-[11px] text-white/30 py-2">Este activo no tiene columnas registradas. Agrégalas en la ficha del activo (botón «Columna») para declarar qué campos viajan.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-white/8 p-1.5">
                {columns.map((c) => (
                  <label key={c.name} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" checked={picked.has(c.name)} onChange={() => toggle(c.name)} className="accent-cyan-500 mt-0.5 shrink-0" />
                    <span className="min-w-0"><span className="text-[12px] text-white/80">{c.code ? <span className="text-white/40 font-mono">{c.code} · </span> : ''}{c.name}</span>{c.description && <span className="block text-[10px] text-white/35 truncate">{c.description}</span>}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-medium text-white/50 mb-1 uppercase tracking-wide">Justificación</label>
            <textarea rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="¿Por qué se comparte este activo con ese subproceso?"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-white/50 hover:text-white/80 rounded-lg">Cancelar</button>
          <button onClick={() => onConfirm(direction, selected, justification)} className="px-5 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500">Conectar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
