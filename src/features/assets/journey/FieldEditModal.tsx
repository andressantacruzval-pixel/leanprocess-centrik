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
  const inp = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500'
  const lbl = 'block text-[10px] font-medium text-gray-500 mb-1 uppercase tracking-wide'

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-gray-900/45">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 border border-gray-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2"><Columns3 size={15} className="text-primary-600" /><h3 className="text-sm font-semibold text-gray-900">Columna del activo</h3></div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600"><X size={17} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1"><label className={lbl}>Código</label><input className={`${inp} ${lockIdentity ? 'opacity-60 cursor-not-allowed' : ''}`} value={f.code ?? ''} readOnly={lockIdentity} onChange={(e) => set('code', e.target.value)} /></div>
            <div className="col-span-2"><label className={lbl}>Nombre {lockIdentity && <span className="text-gray-400 normal-case">· del origen</span>}</label><input className={`${inp} ${lockIdentity ? 'opacity-60 cursor-not-allowed' : ''}`} value={f.name} readOnly={lockIdentity} onChange={(e) => set('name', e.target.value)} /></div>
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
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800 rounded-lg">Cancelar</button>
          <button onClick={() => { onSave({ ...f, name: f.name.trim() }); onClose() }} disabled={!f.name.trim()} className="px-5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 bg-primary-500 hover:bg-primary-600">Guardar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
