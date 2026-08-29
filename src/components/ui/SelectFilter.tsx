import { ChevronDown } from 'lucide-react'

interface SelectFilterOption {
  value: string
  label: string
}

interface SelectFilterProps {
  value: string
  onChange: (value: string) => void
  options: SelectFilterOption[]
  placeholder?: string
  className?: string
}

export function SelectFilter({ value, onChange, options, placeholder, className }: SelectFilterProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ??
          // El ancho intrinseco de un <select> lo fija su opcion mas larga, y aqui las
          // opciones son nombres de macroproceso: sin tope, un solo filtro empuja a
          // los demas fuera de la pantalla.
          'appearance-none w-full max-w-[45vw] sm:max-w-[12rem] truncate pl-3 pr-7 py-1.5 rounded-lg text-[10px] font-medium bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-300 focus:border-primary-300 focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer'
        }
      >
        {placeholder !== undefined && (
          <option value="" className="bg-surface-ground text-gray-900">{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-ground text-gray-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
