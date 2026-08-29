import { useState, useEffect, useRef } from 'react'

interface EditableTextProps {
  value: string
  onChange: (v: string) => void
  className?: string
  multiline?: boolean
  placeholder?: string
}

export function EditableText({
  value,
  onChange,
  className = '',
  multiline = false,
  placeholder = 'Click para editar...',
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [trackedValue, setTrackedValue] = useState(value)
  const [localValue, setLocalValue] = useState(value)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  // Sincronizar si el valor cambia externamente (ej: actualización por IA)
  if (!editing && trackedValue !== value) {
    setTrackedValue(value)
    setLocalValue(value)
  }

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      if (multiline && ref.current instanceof HTMLTextAreaElement) {
        ref.current.style.height = 'auto'
        ref.current.style.height = ref.current.scrollHeight + 'px'
      }
    }
  }, [editing, multiline])

  const commitAndClose = () => {
    onChange(localValue)
    setEditing(false)
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={localValue}
          onChange={e => {
            setLocalValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onBlur={commitAndClose}
          className={`w-full bg-transparent border-none outline-none resize-none focus:ring-0 p-0 ${className}`}
          rows={2}
        />
      )
    }
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
        type="text"
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={commitAndClose}
        onKeyDown={e => e.key === 'Enter' && commitAndClose()}
        className={`w-full bg-transparent border-none outline-none focus:ring-0 p-0 ${className}`}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-blue-50 rounded-md px-1 -mx-1 transition-colors min-h-[1.2em] ${className} ${!value ? 'text-gray-400 italic' : ''}`}
    >
      {value || placeholder}
    </div>
  )
}
