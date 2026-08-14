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
  VA:    { active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40', inactive: 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10' },
  NVA:   { active: 'bg-red-500/20 text-red-400 border-red-500/40',            inactive: 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10' },
  NVABN: { active: 'bg-amber-500/20 text-amber-400 border-amber-500/40',      inactive: 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10' },
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
            {activity.laneName && <span className="text-[11px] text-white/30">{activity.laneName}</span>}
            {cls && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded ${cls.bg} ${cls.text} font-medium`}>
                {activity.classification}
              </span>
            )}
          </span>
        }
        footer={
          <>
            <button onClick={onClose} className="px-3 py-2 rounded-md text-xs font-medium text-white/40 hover:text-white/60 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSaveAndClose}
              className="px-4 py-2 rounded-md text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Guardar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Clasificación manual */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Clasificación</label>
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
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">Frecuencia</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                    frequency === opt.value
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time per occurrence */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">
              Tiempo por ocurrencia (minutos)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={time || ''}
              onChange={(e) => setTime(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Ej: 15"
            />
          </div>

          {/* Occurrences */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">
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
              className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Ej: 3"
            />
          </div>

          {/* Preview */}
          {time > 0 && (
            <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <p className="text-[9px] text-white/30 uppercase mb-1">Tiempo total por periodo</p>
              <p className="text-sm font-semibold text-white">{time * occurrences} min / {frequency === 'diaria' ? 'día' : frequency === 'semanal' ? 'semana' : frequency === 'mensual' ? 'mes' : 'ocurrencia'}</p>
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
