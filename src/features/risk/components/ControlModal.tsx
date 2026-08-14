import { useState, useCallback, useMemo, useEffect } from 'react'
import { X, Shield, CheckCircle2 } from 'lucide-react'
import type { ControlItem, MitigationType } from '@/types/risk'
import { CONTROL_FACTORS, computeControlScore, EFFECTIVENESS_COLORS } from '@/types/risk'

interface ControlModalProps {
  control: ControlItem
  onSave: (updated: Partial<ControlItem>) => void
  onClose: () => void
}

export function ControlModal({ control, onSave, onClose }: ControlModalProps) {
  const [form, setForm] = useState({ ...control })
  const [saved, setSaved] = useState(false)

  const { score, effectiveness } = useMemo(
    () => computeControlScore(form),
    [form]
  )

  const handleChange = useCallback((key: string, value: number | string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(onClose, 1200)
    return () => clearTimeout(t)
  }, [saved, onClose])

  const handleSave = () => {
    const { score: s, effectiveness: e } = computeControlScore(form)
    onSave({ ...form, score: s, effectiveness: e })
    setSaved(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1420] rounded-2xl shadow-xl w-full max-w-lg mx-4 border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Evaluar Control</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Description */}
          <div>
            <label className="block text-[10px] font-medium text-white/50 mb-1">Descripcion del control</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white focus:ring-1 focus:ring-cyan-500/50"
              placeholder="Describe el control..."
            />
          </div>

          {/* Mitigates */}
          <div>
            <label className="block text-[10px] font-medium text-white/50 mb-1">Mitiga</label>
            <div className="flex gap-2">
              {(['Probabilidad', 'Impacto', 'Ambos'] as MitigationType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleChange('mitigates', m)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                    form.mitigates === m
                      ? 'bg-cyan-600/20 border-cyan-500/30 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 8 Effectiveness Factors */}
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
                        onClick={() => handleChange(factor.key, opt.value)}
                        className={`flex-1 px-2 py-1 rounded text-[9px] font-medium border transition-all ${
                          form[factor.key] === opt.value
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

          {/* Score preview */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div>
              <span className="text-[10px] text-white/40">Puntaje: </span>
              <span className="text-sm font-bold text-white">{score}/40</span>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${EFFECTIVENESS_COLORS[effectiveness]}`}>
              {effectiveness}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-white/40 hover:text-white/70">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`px-5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              saved
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500'
            }`}
          >
            {saved ? <><CheckCircle2 size={13} />Guardado</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
