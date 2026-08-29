import { useState, useEffect, useRef } from 'react'
import { X, BarChart3, Users, Wrench } from 'lucide-react'
import { PROCESS_CATEGORIES } from '@/lib/constants'
import type { Macroprocess } from '@/types'

const CATEGORY_OPTIONS: {
  key: 'estrategico' | 'productivo' | 'apoyo'
  icon: typeof BarChart3
}[] = [
  { key: 'estrategico', icon: BarChart3 },
  { key: 'productivo', icon: Users },
  { key: 'apoyo', icon: Wrench },
]

interface NewMacroprocessModalProps {
  open: boolean
  onClose: () => void
  onSave: (name: string, category: 'estrategico' | 'productivo' | 'apoyo') => void
  editMacro?: Macroprocess | null
  defaultCategory?: 'estrategico' | 'productivo' | 'apoyo'
}

export function NewMacroprocessModal({
  open,
  onClose,
  onSave,
  editMacro,
  defaultCategory,
}: NewMacroprocessModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<'estrategico' | 'productivo' | 'apoyo'>(
    defaultCategory || 'productivo'
  )
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // setState en effect es intencional: rellena el form al abrir/cambiar de modo
  // (crear vs editar). El modal vive permanentemente; no se desmonta entre usos.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      if (editMacro) {
        setName(editMacro.name)
        setCategory(editMacro.category)
      } else {
        setName('')
        setCategory(defaultCategory || 'productivo')
      }
      setError('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, editMacro, defaultCategory])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('El nombre es obligatorio')
      return
    }
    onSave(trimmed, category)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/45" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto mx-4 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {editMacro ? 'Editar macroproceso' : 'Nuevo macroproceso'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre del macroproceso
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder="Ej: Gestion Estrategica"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-300 placeholder:text-gray-400
                         transition-shadow"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>

          {/* Category selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map(({ key, icon: Icon }) => {
                const config = PROCESS_CATEGORIES[key]
                const selected = category === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-1.5 p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                      selected
                        ? 'border-current shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 text-gray-500'
                    }`}
                    style={selected ? { color: config.color, backgroundColor: config.bgColor } : {}}
                  >
                    <Icon size={20} />
                    <span className="text-xs">{config.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm bg-primary-500 hover:bg-primary-600"
            >
              {editMacro ? 'Guardar cambios' : 'Crear macroproceso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
