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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/45">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 border border-gray-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary-600" />
            <h3 className="text-sm font-semibold text-gray-900">Evaluar Control</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-50 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Description */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Descripcion del control</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-900 focus:ring-1 focus:ring-primary-500"
              placeholder="Describe el control..."
            />
          </div>

          {/* Mitigates */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Mitiga</label>
            <div className="flex gap-2">
              {(['Probabilidad', 'Impacto', 'Ambos'] as MitigationType[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleChange('mitigates', m)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all ${
                    form.mitigates === m
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 8 Effectiveness Factors */}
          <div className="space-y-2">
            <label className="block text-[10px] font-medium text-gray-500">Variables de efectividad</label>
            <div className="grid grid-cols-1 gap-2">
              {CONTROL_FACTORS.map((factor) => (
                <div key={factor.key} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-24 shrink-0">{factor.label}</span>
                  <div className="flex gap-1 flex-1">
                    {factor.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleChange(factor.key, opt.value)}
                        className={`flex-1 px-2 py-1 rounded-md text-[9px] font-medium border transition-all ${
                          form[factor.key] === opt.value
                            ? 'bg-primary-100 border-primary-300 text-primary-700'
                            : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-600'
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
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div>
              <span className="text-[10px] text-gray-500">Puntaje: </span>
              <span className="text-sm font-bold text-gray-900">{score}/40</span>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${EFFECTIVENESS_COLORS[effectiveness]}`}>
              {effectiveness}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`px-5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              saved
                ? 'bg-emerald-600 text-white cursor-default'
                : 'text-white bg-primary-500 hover:bg-primary-600'
            }`}
          >
            {saved ? <><CheckCircle2 size={13} />Guardado</> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
