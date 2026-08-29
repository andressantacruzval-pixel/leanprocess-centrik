import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { ConfirmUnsavedModal } from '@/components/ui/ConfirmUnsavedModal'
import type { ValueActivity, Frequency, ValueClassification } from '@/utils/valueAnalysis'
import { CLASSIFICATION_COLORS, FREQUENCY_OPTIONS } from '@/utils/valueAnalysis'

interface Props {
  activity: ValueActivity
  onSave: (updates: { frequency: Frequency; timePerOccurrence: number; occurrences: number; classification: ValueClassification | null }) => void
  onClose: () => void
}

const TOGGLE_MODAL: Record<ValueClassification, { active: string; inactive: string }> = {
  VA:    { active: 'bg-emerald-100 text-emerald-600 border-emerald-300', inactive: 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100' },
  NVA:   { active: 'bg-red-100 text-red-600 border-red-300',            inactive: 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100' },
  NVABN: { active: 'bg-amber-100 text-amber-600 border-amber-300',      inactive: 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100' },
}

export function EditValueActivityModal({ activity, onSave, onClose }: Props) {
  const [frequency, setFrequency] = useState<Frequency>(activity.frequency)
  const [time, setTime] = useState(activity.timePerOccurrence)
  const [occurrences, setOccurrences] = useState(activity.occurrences)
  const [occurrencesInput, setOccurrencesInput] = useState(String(activity.occurrences))
  const [classification, setClassification] = useState<ValueClassification | null>(activity.classification)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const isDirty =
    frequency !== activity.frequency ||
    time !== activity.timePerOccurrence ||
    occurrences !== activity.occurrences ||
    classification !== activity.classification

  const handleSaveAndClose = () => {
    onSave({ frequency, timePerOccurrence: time, occurrences, classification })
  }

  const handleCloseAttempt = () => {
    if (isDirty) setShowConfirmClose(true)
    else onClose()
  }

  // El Escape lo gestiona <Modal>, que llama a `handleCloseAttempt`. Este componente
  // tenia su propio escuchador; al migrar, los dos disparaban con la misma tecla.

  const cls = classification ? CLASSIFICATION_COLORS[classification] : null

  return (
    <>
      <Modal
        open
        onClose={handleCloseAttempt}
        size="sm"
        title={activity.name}
        subtitle={
          <span className="flex items-center gap-2">
            {activity.laneName && <span className="text-[11px] text-gray-400">{activity.laneName}</span>}
            {cls && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${cls.bg} ${cls.text} font-medium`}>
                {activity.classification}
              </span>
            )}
          </span>
        }
        footer={
          <>
            <button onClick={onClose} className="px-3 py-2 rounded-md text-xs font-medium text-gray-500 hover:text-gray-600 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-2 rounded-md text-xs font-medium bg-blue-100 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              Guardar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Clasificación manual */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Clasificación</label>
            <div className="flex gap-2">
              {(['VA', 'NVA', 'NVABN'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClassification(type)}
                  className={`flex-1 py-2 rounded-md text-xs font-medium border transition-all ${
                    classification === type
                      ? TOGGLE_MODAL[type].active
                      : TOGGLE_MODAL[type].inactive
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">Frecuencia</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                    frequency === opt.value
                      ? 'bg-blue-100 text-blue-600 border border-blue-300'
                      : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time per occurrence */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
              Tiempo por ocurrencia (minutos)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={time || ''}
              onChange={(e) => setTime(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Ej: 15"
            />
          </div>

          {/* Occurrences */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
              Veces por {frequency === 'diaria' ? 'día' : frequency === 'semanal' ? 'semana' : frequency === 'mensual' ? 'mes' : 'ocurrencia'}
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={occurrencesInput}
              onChange={(e) => setOccurrencesInput(e.target.value)}
              onBlur={() => {
                const n = Math.max(1, Number(occurrencesInput) || 1)
                setOccurrences(n)
                setOccurrencesInput(String(n))
              }}
              className="w-full px-3 py-2 rounded-md bg-gray-50 border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Ej: 3"
            />
          </div>

          {/* Preview */}
          {time > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-[9px] text-gray-400 uppercase mb-1">Tiempo total por periodo</p>
              <p className="text-sm font-semibold text-gray-900">{time * occurrences} min / {frequency === 'diaria' ? 'día' : frequency === 'semanal' ? 'semana' : frequency === 'mensual' ? 'mes' : 'ocurrencia'}</p>
            </div>
          )}
        </div>
      </Modal>
      {showConfirmClose && (
        <ConfirmUnsavedModal onDiscard={onClose} onSave={handleSaveAndClose} />
      )}
    </>
  )
}
