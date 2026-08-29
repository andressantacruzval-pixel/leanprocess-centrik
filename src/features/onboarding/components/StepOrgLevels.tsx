import { useState, useEffect } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { DEFAULT_ORG_LEVELS, ORG_LEVEL_COLORS } from '@/lib/constants'
import { Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react'
import type { OrgLevelDefinition } from '@/types'

interface StepOrgLevelsProps {
  onNext: () => void
  onBack: () => void
}

export function StepOrgLevels({ onNext, onBack }: StepOrgLevelsProps) {
  const company = useCompanyStore((s) => s.company)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)
  const setOrgLevelDefinitions = useCompanyStore((s) => s.setOrgLevelDefinitions)

  const [levels, setLevels] = useState<{ id: string; name: string }[]>([])

  // Inicialización del estado local desde el store al montar. Sólo corre
  // una vez (deps vacías) — orgLevelDefinitions se considera la fuente.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (orgLevelDefinitions.length > 0) {
      setLevels(orgLevelDefinitions.map((d) => ({ id: d.id, name: d.level_name })))
    } else {
      setLevels(
        DEFAULT_ORG_LEVELS.map((name) => ({
          id: crypto.randomUUID(),
          name,
        }))
      )
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleAdd = () => {
    setLevels([...levels, { id: crypto.randomUUID(), name: '' }])
  }

  const handleRemove = (id: string) => {
    if (levels.length <= 1) return
    setLevels(levels.filter((l) => l.id !== id))
  }

  const handleNameChange = (id: string, name: string) => {
    setLevels(levels.map((l) => (l.id === id ? { ...l, name } : l)))
  }

  const handleNext = () => {
    const defs: OrgLevelDefinition[] = levels.map((l, i) => ({
      id: l.id,
      company_id: company?.id ?? '',
      level_number: i,
      level_name: l.name.trim(),
      created_at: new Date().toISOString(),
    }))
    setOrgLevelDefinitions(defs)
    onNext()
  }

  const allFilled = levels.every((l) => l.name.trim().length > 0)

  return (
    <div className="flex flex-col items-center flex-1 px-4 max-w-4xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
        Define los niveles de tu estructura organizacional
      </h2>
      <p className="text-gray-500 mb-8 text-center">
        Como se organizan los cargos en tu empresa?
      </p>

      <div className="flex flex-col lg:flex-row gap-8 w-full mb-8">
        {/* Level inputs */}
        <div className="flex-1">
          <div className="space-y-3">
            {levels.map((level, index) => (
              <div key={level.id} className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-900 text-sm font-bold shrink-0"
                  style={{ backgroundColor: ORG_LEVEL_COLORS[index % ORG_LEVEL_COLORS.length] }}
                >
                  {index + 1}
                </span>
                <input
                  type="text"
                  value={level.name}
                  onChange={(e) => handleNameChange(level.id, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`Nivel ${index + 1}`}
                />
                <button
                  onClick={() => handleRemove(level.id)}
                  disabled={levels.length <= 1}
                  className="p-2 text-gray-300 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAdd}
            className="mt-4 flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors"
          >
            <Plus size={16} />
            Agregar nivel
          </button>
        </div>

        {/* Visual preview */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-0">
            {levels
              .filter((l) => l.name.trim())
              .map((level, index, arr) => (
                <div key={level.id} className="flex flex-col items-center">
                  <div
                    className="px-6 py-3 rounded-lg text-gray-900 font-semibold text-sm text-center min-w-[160px] shadow-md"
                    style={{
                      backgroundColor: ORG_LEVEL_COLORS[index % ORG_LEVEL_COLORS.length],
                    }}
                  >
                    {level.name}
                  </div>
                  {index < arr.length - 1 && (
                    <div className="w-0.5 h-6 bg-gray-200" />
                  )}
                </div>
              ))}
          </div>
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
          disabled={!allFilled}
          className="flex items-center gap-2 px-8 py-2.5 text-white rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500 hover:bg-primary-600"
        >
          Siguiente
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
