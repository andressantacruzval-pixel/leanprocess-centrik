import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowRight, ShieldCheck } from 'lucide-react'
import { ASSET_OPERATIONS, type AssetColumn } from '@/types/asset'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { STATE_COLORS, type JourneyEdgeLink } from './journeyGraph'

interface Props {
  links: JourneyEdgeLink[]
  onSave: (opId: string, columns: AssetColumn[], justification: string, destOperation: string, medium: string, mediumDetail: string) => void
  onOpenAsset?: (assetId: string) => void
  onClose: () => void
}

interface Draft { picked: Set<string>; justification: string; dest: string; medium: string; mediumDetail: string }

// Detalle de una flecha del Data Journey: qué activos se transfieren y con qué
// columnas. Un bloque por activo, editable en el sitio (columnas + justificación).
export function JourneyEdgeModal({ links, onSave, onOpenAsset, onClose }: Props) {
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const mediumOpts = getCatalogByType('transfer_medium').map((c) => ({ value: c.value, label: c.value }))
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const m: Record<string, Draft> = {}
    links.forEach((l) => { m[l.opId] = { picked: new Set(l.columns.map((c) => c.name)), justification: l.justification, dest: l.destOperation ?? '', medium: l.medium ?? '', mediumDetail: l.mediumDetail ?? '' } })
    return m
  })
  const totalCols = links.reduce((s, l) => s + (drafts[l.opId]?.picked.size ?? 0), 0)

  const toggle = (opId: string, name: string) => setDrafts((d) => {
    const cur = d[opId]; const picked = new Set(cur.picked)
    if (picked.has(name)) picked.delete(name); else picked.add(name)
    return { ...d, [opId]: { ...cur, picked } }
  })
  const setJust = (opId: string, v: string) => setDrafts((d) => ({ ...d, [opId]: { ...d[opId], justification: v } }))
  const setDest = (opId: string, v: string) => setDrafts((d) => ({ ...d, [opId]: { ...d[opId], dest: v } }))
  const setField = (opId: string, k: 'medium' | 'mediumDetail', v: string) => setDrafts((d) => ({ ...d, [opId]: { ...d[opId], [k]: v } }))

  const saveAll = () => {
    links.forEach((l) => {
      const d = drafts[l.opId]; if (!d) return
      // Conserva el tratamiento POR SUBPROCESO de las columnas ya presentes en el
      // enlace (l.columns); solo las nuevas heredan la definición del origen. Así
      // marcar/desmarcar columnas aquí no pisa el tratamiento fijado en destino.
      const existing = new Map(l.columns.map((c) => [c.name, c]))
      const cols = l.assetColumns.filter((c) => d.picked.has(c.name)).map((c) => existing.get(c.name) ?? c)
      onSave(l.opId, cols, d.justification, d.dest, d.medium, d.mediumDetail)
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/45">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 border border-gray-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><ArrowRight size={16} className="text-primary-600" /><h3 className="text-sm font-semibold text-gray-900">Transferencia · {links.length} activo{links.length === 1 ? '' : 's'} · {totalCols} columnas</h3></div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {links.map((l) => {
            const d = drafts[l.opId]
            return (
              <div key={l.opId} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5 min-w-0"><ShieldCheck size={13} className="text-primary-700 shrink-0" /><span className="truncate">{l.assetName}</span></p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-primary-700">{d?.picked.size ?? 0} de {l.assetColumns.length} columnas</span>
                    {onOpenAsset && <button onClick={() => onOpenAsset(l.assetId)} className="text-[10px] text-gray-500 hover:text-gray-800 underline">Abrir ficha</button>}
                  </div>
                </div>
                <p className="text-[9.5px] text-gray-400 mb-1">Marca las columnas que llegan al destino. Las desmarcadas existen pero no se envían.</p>
                {l.assetColumns.length === 0 ? (
                  <p className="text-[11px] text-gray-400">Este activo no tiene columnas registradas. Ábrelo para declararlas.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {l.assetColumns.map((c) => (
                      <label key={c.name} className="flex items-start gap-2 px-2 py-1 rounded-md hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={d?.picked.has(c.name) ?? false} onChange={() => toggle(l.opId, c.name)} className="accent-primary-500 mt-0.5 shrink-0" />
                        <span className="min-w-0 flex-1"><span className="text-[11.5px] text-gray-800">{c.code ? <span className="text-gray-500 font-mono">{c.code} · </span> : ''}{c.name}</span>{c.description && <span className="block text-[9.5px] text-gray-400 truncate">{c.description}</span>}</span>
                        {c.operation && <span className="text-[8px] px-1 py-0.5 rounded-md shrink-0" style={{ background: `${STATE_COLORS[c.operation] ?? '#64748b'}22`, color: STATE_COLORS[c.operation] ?? '#94a3b8' }}>{c.operation}</span>}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <input value={d?.justification ?? ''} onChange={(e) => setJust(l.opId, e.target.value)} placeholder="Justificación de la transferencia…"
                    className="flex-1 min-w-[160px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <select value={d?.dest ?? ''} onChange={(e) => setDest(l.opId, e.target.value)} title="¿Qué hace el proceso destino con el dato?"
                    className="shrink-0 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="">Tratamiento en destino…</option>
                    {ASSET_OPERATIONS.filter((o) => o.value !== 'transfiere').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="w-44 shrink-0"><CreatableSelect options={mediumOpts} value={d?.medium ?? ''} onChange={(v) => setField(l.opId, 'medium', v)} onCreateOption={(v) => addCatalogItem('transfer_medium', v)} placeholder="Medio de transferencia…" /></div>
                  <input value={d?.mediumDetail ?? ''} onChange={(e) => setField(l.opId, 'mediumDetail', e.target.value)} placeholder="Descripción del medio (buzón, ruta, carpeta…)"
                    className="flex-1 min-w-[150px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800 rounded-lg">Cerrar</button>
          <button onClick={saveAll} className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-primary-500 hover:bg-primary-600">Guardar cambios</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
