import { useState } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { Building2, ArrowRight } from 'lucide-react'
import { ComboboxSelect } from '@/components/ui/ComboboxSelect'
import { INDUSTRY_OPTIONS, COUNTRY_OPTIONS, SIZE_OPTIONS } from '@/utils/selectOptions'

interface StepCompanyNameProps {
  onNext: () => void
}


export function StepCompanyName({ onNext }: StepCompanyNameProps) {
  const company = useCompanyStore((s) => s.company)
  const setCompanyInfo = useCompanyStore((s) => s.setCompanyInfo)
  const [name, setName] = useState(company?.name ?? '')
  const [industry, setIndustry] = useState(company?.industry ?? '')
  const [companySize, setCompanySize] = useState(company?.company_size ?? '')
  const [country, setCountry] = useState(company?.country ?? '')
  const [description, setDescription] = useState(company?.description ?? '')

  const isValid = name.trim() && industry.trim()

  const handleNext = () => {
    if (isValid) {
      setCompanyInfo({
        name: name.trim(),
        industry: industry.trim(),
        company_size: companySize || undefined,
        country: country.trim() || undefined,
        description: description.trim() || undefined,
      })
      onNext()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleNext()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4">
      <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center mb-6">
        <Building2 className="text-primary-600" size={32} />
      </div>

      <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
        Cuentanos sobre tu empresa
      </h2>
      <p className="text-gray-500 mb-8 text-center max-w-lg">
        Esta informacion nos ayudara a personalizar tu experiencia y generar recomendaciones mas precisas con IA
      </p>

      <div className="w-full max-w-lg space-y-4">
        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la empresa <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: Litransa SA"
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Two-column row: Industry + Size */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industria / Giro de negocio <span className="text-red-600">*</span>
            </label>
            <ComboboxSelect
              value={industry}
              onChange={setIndustry}
              options={INDUSTRY_OPTIONS}
              placeholder="Buscar industria..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tamaño de empresa
            </label>
            <ComboboxSelect
              value={companySize}
              onChange={setCompanySize}
              options={SIZE_OPTIONS}
              placeholder="Seleccionar tamaño..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
            />
          </div>
        </div>

        {/* Country */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pais
          </label>
          <ComboboxSelect
            value={country}
            onChange={setCountry}
            options={COUNTRY_OPTIONS}
            placeholder="Buscar país..."
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Breve descripcion <span className="text-gray-300 font-normal">(opcional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe brevemente a que se dedica tu empresa"
            rows={3}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={!isValid}
        className="mt-6 flex items-center gap-2 px-8 py-3 text-white rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500 hover:bg-primary-600"
      >
        Siguiente
        <ArrowRight size={18} />
      </button>
    </div>
  )
}
