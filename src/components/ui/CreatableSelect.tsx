import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown } from 'lucide-react'

interface CreatableSelectProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  onCreateOption?: (value: string) => void
  placeholder?: string
  className?: string
}

export function CreatableSelect({
  options,
  value,
  onChange,
  onCreateOption,
  placeholder = 'Seleccionar...',
  className = '',
}: CreatableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const selectedLabel = options.find((o) => o.value === value)?.label || ''

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCreate = () => {
    const trimmed = search.trim()
    if (trimmed && onCreateOption) {
      onCreateOption(trimmed)
      onChange(trimmed)
      setSearch('')
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar o crear..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length === 0 && search.trim()) {
                  handleCreate()
                }
              }}
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            {filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                  setSearch('')
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  option.value === value ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}

            {filtered.length === 0 && search.trim() && onCreateOption && (
              <button
                type="button"
                onClick={handleCreate}
                className="w-full text-left px-3 py-2 text-sm text-primary-600 hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus size={14} />
                Crear "{search.trim()}"
              </button>
            )}

            {filtered.length === 0 && !search.trim() && (
              <div className="px-3 py-2 text-sm text-gray-400">Sin opciones</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
