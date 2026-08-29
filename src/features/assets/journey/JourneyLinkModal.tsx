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

  const dirBtn = (active: boolean) => `flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium border transition-all ${active ? 'bg-primary-100 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-800'}`

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/45">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 border border-gray-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Columns3 size={16} className="text-primary-600" /><h3 className="text-sm font-semibold text-gray-900">Conectar activo con subproceso</h3></div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-[12px] text-gray-600"><span className="text-gray-900 font-medium">{assetName}</span> ↔ <span className="text-gray-900 font-medium">{targetName}</span></p>

          {!fixedDirection && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Dirección</label>
              <div className="flex gap-2">
                <button onClick={() => setDirection('to')} className={dirBtn(direction === 'to')}><ArrowRight size={13} /> Sale hacia {targetName}</button>
                <button onClick={() => setDirection('from')} className={dirBtn(direction === 'from')}><ArrowLeft size={13} /> Entra desde {targetName}</button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Columnas que viajan</label>
              <span className="text-[10px] text-primary-700 font-medium">{selected.length} de {columns.length}</span>
            </div>
            {columns.length === 0 ? (
              <p className="text-[11px] text-gray-400 py-2">Este activo no tiene columnas registradas. Agrégalas en la ficha del activo (botón «Columna») para declarar qué campos viajan.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100 p-1.5">
                {columns.map((c) => (
                  <label key={c.name} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={picked.has(c.name)} onChange={() => toggle(c.name)} className="accent-primary-500 mt-0.5 shrink-0" />
                    <span className="min-w-0"><span className="text-[12px] text-gray-800">{c.code ? <span className="text-gray-500 font-mono">{c.code} · </span> : ''}{c.name}</span>{c.description && <span className="block text-[10px] text-gray-400 truncate">{c.description}</span>}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Justificación</label>
            <textarea rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="¿Por qué se comparte este activo con ese subproceso?"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800 rounded-lg">Cancelar</button>
          <button onClick={() => onConfirm(direction, selected, justification)} className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-primary-500 hover:bg-primary-600">Conectar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
