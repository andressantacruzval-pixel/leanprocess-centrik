import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Columns3 } from 'lucide-react'
import { ASSET_OPERATIONS, type AssetColumn } from '@/types/asset'

interface Props {
  column: AssetColumn
  lockIdentity?: boolean
  onSave: (col: AssetColumn) => void
  onClose: () => void
}

// Edición rápida de una columna desde el Data Journey: código, nombre,
// tratamiento y descripción (bidireccional con la ficha del activo). En columnas
// RECIBIDAS (enlace) el código y el nombre son de solo lectura: la identidad la
// fija el activo origen, así que aquí solo se ajusta el tratamiento por-subproceso
// y la descripción (renombrar rompería la correspondencia por nombre).
export function FieldEditModal({ column, lockIdentity, onSave, onClose }: Props) {
  const [f, setF] = useState<AssetColumn>({ ...column })
  const set = (k: keyof AssetColumn, v: string) => setF((p) => ({ ...p, [k]: v }))
  const inp = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/50'
  const lbl = 'block text-[10px] font-medium text-white/50 mb-1 uppercase tracking-wide'

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1420] rounded-2xl shadow-xl w-full max-w-sm mx-4 border border-white/10">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2"><Columns3 size={15} className="text-indigo-400" /><h3 className="text-sm font-semibold text-white">Columna del activo</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1"><label className={lbl}>Código</label><input className={`${inp} ${lockIdentity ? 'opacity-60 cursor-not-allowed' : ''}`} value={f.code ?? ''} readOnly={lockIdentity} onChange={(e) => set('code', e.target.value)} /></div>
            <div className="col-span-2"><label className={lbl}>Nombre {lockIdentity && <span className="text-white/30 normal-case">· del origen</span>}</label><input className={`${inp} ${lockIdentity ? 'opacity-60 cursor-not-allowed' : ''}`} value={f.name} readOnly={lockIdentity} onChange={(e) => set('name', e.target.value)} /></div>
          </div>
          <div>
            <label className={lbl}>Tratamiento</label>
            <select className={inp} value={f.operation ?? ''} onChange={(e) => set('operation', e.target.value)}>
              <option value="">Sin definir…</option>
              {ASSET_OPERATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Descripción</label><textarea rows={2} className={`${inp} resize-none`} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-white/50 hover:text-white/80 rounded-lg">Cancelar</button>
          <button onClick={() => { onSave({ ...f, name: f.name.trim() }); onClose() }} disabled={!f.name.trim()} className="px-5 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40">Guardar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
