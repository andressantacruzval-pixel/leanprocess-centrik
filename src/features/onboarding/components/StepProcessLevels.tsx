import { useState, useEffect } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { PROCESS_LEVEL_OPTIONS } from '@/lib/constants'
import { Check, AlertTriangle, ArrowLeft, ArrowRight, Star } from 'lucide-react'
import type { ProcessLevelName } from '@/types'

interface StepProcessLevelsProps {
  onNext: () => void
  onBack: () => void
}

export function StepProcessLevels({ onNext, onBack }: StepProcessLevelsProps) {
  const company = useCompanyStore((s) => s.company)
  const processLevelNames = useCompanyStore((s) => s.processLevelNames)
  const setProcessLevelCount = useCompanyStore((s) => s.setProcessLevelCount)
  const setProcessLevelNames = useCompanyStore((s) => s.setProcessLevelNames)
  // Clamp a 2: una empresa antigua puede traer 1, que ya no es una opción válida.
  const [selectedCount, setSelectedCount] = useState(Math.max(2, company?.process_level_count ?? 3))
  const [names, setNames] = useState<string[]>([])

  // Sincroniza la lista de nombres con el conteo elegido. setState en effect
  // es la forma idiomática para reaccionar a cambios de selectedCount externos.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    const option = PROCESS_LEVEL_OPTIONS.find((o) => o.count === selectedCount)
    if (processLevelNames.length > 0 && processLevelNames.length === selectedCount) {
      setNames(processLevelNames.map((p) => p.name))
    } else if (option) {
      setNames([...option.defaultNames])
    }
  }, [selectedCount])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleSelectCount = (count: number) => {
    setSelectedCount(count)
    const option = PROCESS_LEVEL_OPTIONS.find((o) => o.count === count)
    if (option) {
      setNames([...option.defaultNames])
    }
  }

  const handleNameChange = (index: number, value: string) => {
    const updated = [...names]
    updated[index] = value
    setNames(updated)
  }

  const handleNext = () => {
    setProcessLevelCount(selectedCount)
    const levelNames: ProcessLevelName[] = names.map((n, i) => ({
      level_number: i + 1,
      name: n,
    }))
    setProcessLevelNames(levelNames)
    onNext()
  }

  const allNamesFilled = names.every((n) => n.trim().length > 0)

  return (
    <div className="flex flex-col items-center flex-1 px-4 max-w-5xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
        Cuantos niveles de documentacion necesitas?
      </h2>
      <p className="text-gray-500 mb-8 text-center">
        Define como organizaras tu jerarquia de procesos
      </p>

      {/* Cards */}
      {/* Tres columnas para DOS tarjetas dejaba la tercera vacia y las corria a la
          izquierda. El grid se deriva de cuantas opciones hay, asi que si algun dia
          vuelve «1 nivel» no hay que acordarse de tocar esto. */}
      <div
        className={`grid grid-cols-1 gap-4 w-full mb-8 mx-auto ${
          PROCESS_LEVEL_OPTIONS.length === 2
            ? 'md:grid-cols-2 md:max-w-3xl'
            : 'md:grid-cols-3'
        }`}
      >
        {PROCESS_LEVEL_OPTIONS.map((option) => {
          const isSelected = selectedCount === option.count
          const isRecommended = 'recommended' in option && option.recommended

          return (
            <button
              key={option.count}
              onClick={() => handleSelectCount(option.count)}
              className={`relative p-5 rounded-lg border-2 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-lg'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              {isRecommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-white text-xs font-semibold rounded-full flex items-center gap-1 bg-primary-500">
                  <Star size={12} />
                  Recomendado
                </span>
              )}

              <div className="text-3xl font-bold text-gray-900 mb-1">
                {option.count} niveles
              </div>
              <div className="text-sm text-gray-500 mb-4">
                {option.defaultNames.join(' > ')}
              </div>

              <div className="space-y-1.5 mb-3">
                {option.pros.map((pro, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check size={14} className="text-primary-600 mt-0.5 shrink-0" />
                    <span className="text-gray-700">{pro}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                {option.cons.map((con, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                    <span className="text-gray-500">{con}</span>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* Custom names */}
      <div className="w-full max-w-md mb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Personaliza los nombres de cada nivel
        </h3>
        <div className="space-y-3">
          {names.map((name, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-sm font-bold shrink-0">
                {index + 1}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={`Nivel ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={18} />
          Anterior
        </button>
        <button
          onClick={handleNext}
          disabled={!allNamesFilled}
          className="flex items-center gap-2 px-8 py-2.5 text-white rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500 hover:bg-primary-600"
        >
          Siguiente
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
