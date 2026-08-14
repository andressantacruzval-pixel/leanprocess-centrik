import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ProcessIndicator } from '@/types/indicator'

type EditableIndicator = Partial<ProcessIndicator> & { name: string }

interface IndicatorEditModalProps {
  indicator: EditableIndicator
  open: boolean
  onClose: () => void
  onSave: (updated: EditableIndicator) => void
}

function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? null
  const hi = max ?? null
  if (lo === null && hi === null) return '—'
  if (lo !== null && hi !== null) return `${lo} – ${hi}`
  if (lo !== null) return `≥ ${lo}`
  return `≤ ${hi}`
}

function parseNum(val: string): number | null {
  if (val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

export function IndicatorEditModal({ indicator, open, onClose, onSave }: IndicatorEditModalProps) {
  const [form, setForm] = useState<EditableIndicator>(indicator)

  useEffect(() => {
    setForm(indicator)
  }, [indicator])

  if (!open) return null

  function handleChange(field: keyof EditableIndicator, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleNumChange(field: keyof EditableIndicator, value: string) {
    setForm((prev) => ({ ...prev, [field]: parseNum(value) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
    onClose()
  }

  const textFields: Array<{ key: keyof EditableIndicator; label: string; multiline?: boolean }> = [
    { key: 'name', label: 'Nombre del indicador' },
    { key: 'objective', label: 'Objetivo', multiline: true },
    { key: 'formula', label: 'Formula' },
    { key: 'data_source', label: 'Fuente de datos' },
    { key: 'unit_of_measure', label: 'Unidad de medida' },
    { key: 'frequency', label: 'Frecuencia de medicion' },
    { key: 'target_value', label: 'Meta' },
    { key: 'responsible_report', label: 'Responsable del reporte' },
    { key: 'responsible_monitoring', label: 'Responsable del monitoreo' },
  ]

  const f = "w-full border border-white/10 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"

  // `p-4` en el fondo: sin el, a menos de 672px el dialogo tocaba los bordes de la
  // pantalla. Y `flex flex-col` para que el cuerpo pueda desplazarse de verdad.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[#0d1420] border border-white/10 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">Editar Indicador</h3>
          <button onClick={onClose} aria-label="Cerrar" className="-m-2 p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-white/40">
            <X size={20} />
          </button>
        </div>

        {/* Form — `flex-1`, no un `max-h-[70vh]` fijo que contradecia al del padre y
            dejaba el formulario diminuto en movil apaisado. */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {textFields.map(({ key, label, multiline }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-white/70 mb-1">{label}</label>
              {multiline ? (
                <textarea
                  value={(form[key] as string) || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={3}
                  className={f}
                />
              ) : (
                <input
                  type="text"
                  value={(form[key] as string) || ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={f}
                />
              )}
            </div>
          ))}

          {/* Semáforo min/max */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-white/70">Semáforo de Desempeño</p>

            {/* Verde */}
            <div className="p-3 rounded-xl bg-green-500/[0.06] border border-green-500/20">
              <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider mb-2">Verde — Óptimo</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Mínimo</label>
                  <input type="number" value={form.threshold_green_min ?? ''}
                    onChange={e => handleNumChange('threshold_green_min', e.target.value)}
                    className="w-full border border-green-500/20 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white focus:outline-none focus:border-green-400/50"
                    placeholder="ej. 90" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Máximo</label>
                  <input type="number" value={form.threshold_green_max ?? ''}
                    onChange={e => handleNumChange('threshold_green_max', e.target.value)}
                    className="w-full border border-green-500/20 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white focus:outline-none focus:border-green-400/50"
                    placeholder="ej. 100" />
                </div>
              </div>
            </div>

            {/* Amarillo */}
            <div className="p-3 rounded-xl bg-yellow-500/[0.06] border border-yellow-500/20">
              <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-2">Amarillo — Alerta</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Mínimo</label>
                  <input type="number" value={form.threshold_yellow_min ?? ''}
                    onChange={e => handleNumChange('threshold_yellow_min', e.target.value)}
                    className="w-full border border-yellow-500/20 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white focus:outline-none focus:border-yellow-400/50"
                    placeholder="ej. 70" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Máximo</label>
                  <input type="number" value={form.threshold_yellow_max ?? ''}
                    onChange={e => handleNumChange('threshold_yellow_max', e.target.value)}
                    className="w-full border border-yellow-500/20 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white focus:outline-none focus:border-yellow-400/50"
                    placeholder="ej. 89" />
                </div>
              </div>
            </div>

            {/* Rojo */}
            <div className="p-3 rounded-xl bg-red-500/[0.06] border border-red-500/20">
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-2">Rojo — Crítico</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Mínimo</label>
                  <input type="number" value={form.threshold_red_min ?? ''}
                    onChange={e => handleNumChange('threshold_red_min', e.target.value)}
                    className="w-full border border-red-500/20 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white focus:outline-none focus:border-red-400/50"
                    placeholder="ej. 0" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Máximo</label>
                  <input type="number" value={form.threshold_red_max ?? ''}
                    onChange={e => handleNumChange('threshold_red_max', e.target.value)}
                    className="w-full border border-red-500/20 rounded-lg px-3 py-2 text-sm bg-white/[0.03] text-white focus:outline-none focus:border-red-400/50"
                    placeholder="ej. 69" />
                </div>
              </div>
            </div>
          </div>

          {/* Threshold preview */}
          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
            <p className="text-xs font-medium text-white/40 mb-3">Vista previa del semáforo</p>
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                <span className="w-4 h-4 rounded-full bg-green-500 inline-block mb-1" />
                <p className="text-xs text-green-400">{formatRange(form.threshold_green_min, form.threshold_green_max)}</p>
              </div>
              <div className="flex-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
                <span className="w-4 h-4 rounded-full bg-yellow-400 inline-block mb-1" />
                <p className="text-xs text-yellow-400">{formatRange(form.threshold_yellow_min, form.threshold_yellow_max)}</p>
              </div>
              <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <span className="w-4 h-4 rounded-full bg-red-500 inline-block mb-1" />
                <p className="text-xs text-red-400">{formatRange(form.threshold_red_min, form.threshold_red_max)}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-colors"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
