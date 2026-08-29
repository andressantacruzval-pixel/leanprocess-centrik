import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Shield, ShieldCheck, Plus, Pencil, Trash2 } from 'lucide-react'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { useAssetStore } from '@/stores/assetStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { getRiskLevel, PROBABILITY_LABELS, IMPACT_LABELS, EFFECTIVENESS_COLORS } from '@/types/risk'
import { CIA_IMPACT_SCALE, type InformationAsset } from '@/types/asset'
import { assetInherentImpact, calculateAssetResidual, type AssetControl } from '@/types/assetRisk'
import { AssetControlModal } from './AssetControlModal'

interface Props { asset: InformationAsset; onClose: () => void }

const CIA: { key: 'confidentiality' | 'integrity' | 'availability'; dim: 'C' | 'I' | 'A' }[] = [
  { key: 'confidentiality', dim: 'C' }, { key: 'integrity', dim: 'I' }, { key: 'availability', dim: 'A' },
]

// Evaluación de riesgo del activo (ISO 27001/27005). El IMPACTO se valora en tres
// dimensiones (C·I·D) y el del activo es el MAYOR; la PROBABILIDAD es única y se
// liga a ese mayor impacto. Los controles mitigan probabilidad y/o dimensiones,
// y el residual se recalcula en vivo. Misma matriz 5×5 y efectividad que riesgos.
export function AssetRiskModal({ asset, onClose }: Props) {
  const updateAsset = useAssetStore((s) => s.updateAsset)
  const allControls = useAssetStore((s) => s.assetControls)
  const addAssetControl = useAssetStore((s) => s.addAssetControl)
  const updateAssetControl = useAssetStore((s) => s.updateAssetControl)
  const deleteAssetControl = useAssetStore((s) => s.deleteAssetControl)
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)

  const controls = useMemo(() => allControls.filter((c) => c.asset_id === asset.id), [allControls, asset.id])
  const [editingControl, setEditingControl] = useState<AssetControl | null>(null)

  const [draft, setDraft] = useState({
    confidentiality: asset.confidentiality, integrity: asset.integrity, availability: asset.availability,
    probability: asset.probability, threat: asset.threat || '', vulnerability: asset.vulnerability || '',
  })
  const setD = (k: keyof typeof draft, v: unknown) => setDraft((p) => ({ ...p, [k]: v }))

  const inhImpact = assetInherentImpact(draft.confidentiality, draft.integrity, draft.availability)
  const inhLevel = inhImpact && draft.probability ? getRiskLevel(draft.probability, inhImpact) : null
  const residual = useMemo(
    () => calculateAssetResidual(draft.confidentiality, draft.integrity, draft.availability, draft.probability, controls),
    [draft.confidentiality, draft.integrity, draft.availability, draft.probability, controls]
  )
  const resLevel = residual.residualImpact && residual.rProb ? getRiskLevel(residual.rProb, residual.residualImpact) : null

  const handleSave = () => {
    updateAsset(asset.id, {
      confidentiality: draft.confidentiality, integrity: draft.integrity, availability: draft.availability,
      probability: draft.probability, threat: draft.threat, vulnerability: draft.vulnerability,
    })
    onClose()
  }

  const sel = 'w-full px-2 py-1.5 rounded-lg text-[10px] font-medium border-0 text-gray-900'
  const impColor = (v: number) => (v >= 4 ? 'bg-amber-100' : v >= 3 ? 'bg-amber-100' : v >= 1 ? 'bg-emerald-100' : 'bg-gray-100')

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/45">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 border border-gray-200 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2"><Shield size={16} className="text-primary-600" /><h3 className="text-sm font-semibold text-gray-900">Riesgo del activo · {asset.name}</h3></div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Amenaza + vulnerabilidad */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Amenaza</label>
                <CreatableSelect options={getCatalogByType('asset_threat').map((c) => ({ value: c.value, label: c.value }))}
                  value={draft.threat} onChange={(v) => setD('threat', v)} onCreateOption={(v) => { addCatalogItem('asset_threat', v); setD('threat', v) }} placeholder="¿Qué podría dañar el activo?" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Vulnerabilidad</label>
                <CreatableSelect options={getCatalogByType('asset_vulnerability').map((c) => ({ value: c.value, label: c.value }))}
                  value={draft.vulnerability} onChange={(v) => setD('vulnerability', v)} onCreateOption={(v) => { addCatalogItem('asset_vulnerability', v); setD('vulnerability', v) }} placeholder="¿Qué debilidad la habilita?" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-[11px] font-semibold text-gray-600 mb-3 flex items-center gap-2"><Shield size={12} className="text-primary-600" />Evaluación de riesgo</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Inherente */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-gray-500">Riesgo Inherente</span>
                  {CIA.map(({ key, dim }) => (
                    <div key={dim}>
                      <label className="block text-[9px] text-gray-400 mb-0.5">Impacto · {CIA_IMPACT_SCALE[dim].label}</label>
                      <select value={draft[key] ?? ''} onChange={(e) => setD(key, e.target.value ? Number(e.target.value) : null)}
                        title={draft[key] ? CIA_IMPACT_SCALE[dim].levels[draft[key] as number] : ''}
                        className={`${sel} ${draft[key] ? impColor(draft[key] as number) : 'bg-gray-50'}`}>
                        <option value="" className="bg-surface-ground text-gray-900">—</option>
                        {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v} className="bg-surface-ground text-gray-900">{v} - {IMPACT_LABELS[v]}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-[9px] text-gray-400 mb-0.5">Probabilidad</label>
                    <select value={draft.probability ?? ''} onChange={(e) => setD('probability', e.target.value ? Number(e.target.value) : null)}
                      className={`${sel} ${draft.probability ? impColor(draft.probability) : 'bg-gray-50'}`}>
                      <option value="" className="bg-surface-ground text-gray-900">—</option>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v} className="bg-surface-ground text-gray-900">{v} - {PROBABILITY_LABELS[v]}</option>)}
                    </select>
                  </div>
                  <div className="text-[9px] text-gray-400">Impacto = mayor de C·I·D: <strong className="text-gray-600">{inhImpact || '—'}</strong></div>
                  <div className={`px-3 py-2 rounded-lg text-center text-[10px] font-bold text-gray-900 ${inhLevel?.color ?? 'bg-gray-100'}`}>{inhLevel?.label ?? 'Sin valorar'}</div>
                </div>

                {/* Controles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-500">Controles</span>
                    <button onClick={() => { const c = addAssetControl(asset.id); if (c) setEditingControl(c) }} className="p-1 rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100"><Plus size={12} /></button>
                  </div>
                  {controls.length === 0 ? (
                    <p className="text-[9px] text-gray-300 text-center py-4">Sin controles</p>
                  ) : (
                    <div className="space-y-1.5">
                      {controls.map((c) => (
                        <div key={c.id} className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2 flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${c.effectiveness === 'Optimo' ? 'bg-primary-500' : c.effectiveness === 'Bueno' ? 'bg-emerald-500' : c.effectiveness === 'Regular' ? 'bg-amber-500' : c.effectiveness === 'Debil' ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <p className="text-[9px] text-gray-600 flex-1 truncate" title={c.description}>{c.description || 'Sin descripción'}</p>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${EFFECTIVENESS_COLORS[c.effectiveness]}`}>{c.score}/40</span>
                          <button onClick={() => setEditingControl(c)} className="p-0.5 text-gray-300 hover:text-primary-600" title="Evaluar control"><Pencil size={10} /></button>
                          <button onClick={() => deleteAssetControl(c.id)} className="p-0.5 text-gray-300 hover:text-red-600" title="Eliminar control"><Trash2 size={10} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Residual */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-gray-500">Riesgo Residual</span>
                  {CIA.map(({ dim }, idx) => {
                    const rv = idx === 0 ? residual.rc : idx === 1 ? residual.ri : residual.ra
                    return (
                      <div key={dim}>
                        <label className="block text-[9px] text-gray-400 mb-0.5">Impacto · {CIA_IMPACT_SCALE[dim].label}</label>
                        <div className={`${sel} ${rv ? impColor(rv) : 'bg-gray-50'}`}>{rv || '—'}{rv ? ` - ${IMPACT_LABELS[rv]}` : ''}</div>
                      </div>
                    )
                  })}
                  <div>
                    <label className="block text-[9px] text-gray-400 mb-0.5">Probabilidad</label>
                    <div className={`${sel} ${residual.rProb ? impColor(residual.rProb) : 'bg-gray-50'}`}>{residual.rProb || '—'}{residual.rProb ? ` - ${PROBABILITY_LABELS[residual.rProb]}` : ''}</div>
                  </div>
                  <div className="text-[9px] text-gray-400">Impacto = mayor de C·I·D: <strong className="text-gray-600">{residual.residualImpact || '—'}</strong></div>
                  <div className={`px-3 py-2 rounded-lg text-center text-[10px] font-bold text-gray-900 ${resLevel?.color ?? 'bg-gray-100'}`}>{resLevel?.label ?? 'Sin valorar'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-800 rounded-lg">Cancelar</button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg text-xs font-medium text-white inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600"><ShieldCheck size={13} />Guardar</button>
          </div>
        </div>
      </div>

      {editingControl && (
        <AssetControlModal
          control={editingControl}
          onSave={(u) => { updateAssetControl(editingControl.id, u); setEditingControl(null) }}
          onClose={() => setEditingControl(null)}
        />
      )}
    </>,
    document.body
  )
}
