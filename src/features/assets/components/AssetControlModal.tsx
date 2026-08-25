import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Shield } from 'lucide-react'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { CONTROL_FACTORS, EFFECTIVENESS_COLORS } from '@/types/risk'
import type { AssetControl } from '@/types/assetRisk'
import { computeAssetControlScore } from '@/types/assetRisk'

interface Props {
  control: AssetControl
  onSave: (updates: Partial<AssetControl>) => void
  onClose: () => void
}

// Evalúa un control de seguridad del activo: descripción (catálogo Anexo A),
// las 8 variables de efectividad y QUÉ mitiga (probabilidad y/o impacto en
// dimensiones concretas C·I·D). «Si mitiga probabilidad» no habilita impactos;
// las dimensiones solo aparecen al marcar «Mitiga impacto».
export function AssetControlModal({ control, onSave, onClose }: Props) {
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const [form, setForm] = useState<AssetControl>({ ...control })
  const [impactOpen, setImpactOpen] = useState(
    control.mitigates_c || control.mitigates_i || control.mitigates_a
  )

  const { score, effectiveness } = useMemo(() => computeAssetControlScore(form), [form])
  const set = (k: keyof AssetControl, v: unknown) => setForm((p) => ({ ...p, [k]: v }))

  const toggleImpact = (open: boolean) => {
    setImpactOpen(open)
    if (!open) setForm((p) => ({ ...p, mitigates_c: false, mitigates_i: false, mitigates_a: false }))
  }

  const handleSave = () => {
    onSave({ ...form, score, effectiveness })
    onClose()
  }

  const dimBtn = (active: boolean) =>
    `flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
      active ? 'bg-cyan-600/20 border-cyan-500/30 text-cyan-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
    }`

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1420] rounded-2xl shadow-xl w-full max-w-lg mx-4 border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2"><Shield size={18} className="text-cyan-400" /><h3 className="text-sm font-semibold text-white">Evaluar control del activo</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-white/50 mb-1">Control (Anexo A ISO 27001)</label>
            <CreatableSelect
              options={getCatalogByType('asset_control').map((c) => ({ value: c.value, label: c.value }))}
              value={form.description}
              onChange={(v) => set('description', v)}
              onCreateOption={(v) => { addCatalogItem('asset_control', v); set('description', v) }}
              placeholder="Elige o escribe un control…"
            />
          </div>

          {/* Qué mitiga */}
          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-white/50">¿Qué mitiga este control?</label>
            <div className="flex gap-2">
              <button onClick={() => set('mitigates_probability', !form.mitigates_probability)} className={dimBtn(form.mitigates_probability)}>Probabilidad</button>
              <button onClick={() => toggleImpact(!impactOpen)} className={dimBtn(impactOpen)}>Impacto</button>
            </div>
            {impactOpen && (
              <div className="flex gap-2 pl-1">
                <button onClick={() => set('mitigates_c', !form.mitigates_c)} className={dimBtn(form.mitigates_c)} title="Confidencialidad">C · Confidencialidad</button>
                <button onClick={() => set('mitigates_i', !form.mitigates_i)} className={dimBtn(form.mitigates_i)} title="Integridad">I · Integridad</button>
                <button onClick={() => set('mitigates_a', !form.mitigates_a)} className={dimBtn(form.mitigates_a)} title="Disponibilidad">D · Disponibilidad</button>
              </div>
            )}
            {!form.mitigates_probability && !impactOpen && (
              <p className="text-[9px] text-amber-300/70">Marca al menos qué reduce el control para que baje el riesgo residual.</p>
            )}
          </div>

          {/* 8 variables de efectividad */}
          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-white/50">Variables de efectividad</label>
            <div className="grid grid-cols-1 gap-2">
              {CONTROL_FACTORS.map((factor) => (
                <div key={factor.key} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-24 shrink-0">{factor.label}</span>
                  <div className="flex gap-1 flex-1">
                    {factor.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => set(factor.key, opt.value)}
                        className={`flex-1 px-2 py-1 rounded text-[9px] font-medium border transition-all ${
                          (form[factor.key] as number) === opt.value
                            ? 'bg-cyan-600/20 border-cyan-500/30 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div><span className="text-[10px] text-white/40">Puntaje: </span><span className="text-sm font-bold text-white">{score}/40</span></div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${EFFECTIVENESS_COLORS[effectiveness]}`}>{effectiveness}</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-white/40 hover:text-white/70">Cancelar</button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500">Guardar</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
