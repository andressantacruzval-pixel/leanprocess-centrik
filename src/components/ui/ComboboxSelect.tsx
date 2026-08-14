import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'

interface ComboboxSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
}

export function ComboboxSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
}: ComboboxSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  )

  // `useCallback` para poder declararla en las dependencias del efecto que la
  // engancha al `resize`: sin ella, ese oyente conservaba un `filtered` viejo y
  // calculaba el alto del desplegable con el numero de opciones de antes.
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = Math.min(220, filtered.length * 36 + 48)
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight

    // El panel tiene `min-w-[200px]`, que gana al `width` heredado del disparador
    // cuando este es mas estrecho. Sin acotar contra el viewport, un combo en la
    // columna derecha de un `grid-cols-2` dentro de un modal se salia por la derecha.
    const MARGEN = 8
    const ancho = Math.min(Math.max(rect.width, 200), window.innerWidth - MARGEN * 2)
    const izquierda = Math.min(
      Math.max(MARGEN, rect.left),
      window.innerWidth - ancho - MARGEN
    )

    setDropdownStyle({
      position: 'fixed',
      left: izquierda,
      width: ancho,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      zIndex: 9999,
    })
  }, [filtered.length])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setQuery('')
    }
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', calculatePosition)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', calculatePosition)
    }
  }, [open, calculatePosition])

  const handleOpen = () => {
    calculatePosition()
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSelect = (option: string) => {
    onChange(option)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const triggerBase =
    'w-full flex items-center justify-between border border-white/10 bg-white/5 text-sm focus:outline-none focus:border-cyan-500/40 cursor-pointer'

  const triggerClass = className
    ? `${className} flex items-center justify-between focus:outline-none focus:border-cyan-500/40 cursor-pointer`
    : `${triggerBase} px-3 py-2 rounded-lg`

  return (
    <div ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className={triggerClass}
      >
        <span className={value ? 'text-white' : 'text-white/30'}>
          {value || placeholder}
        </span>
        <ChevronDown size={14} className="text-white/30 shrink-0 ml-2" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-[#0d1420] border border-white/10 rounded-lg shadow-2xl overflow-hidden"
        >
          <div className="p-2 border-b border-white/5 flex items-center gap-2 px-3">
            <Search size={13} className="text-white/30 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto max-h-52">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 ${
                  option === value
                    ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                    : 'text-white/70'
                }`}
              >
                {option}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-white/30 text-center">
                Sin resultados para tu búsqueda
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
