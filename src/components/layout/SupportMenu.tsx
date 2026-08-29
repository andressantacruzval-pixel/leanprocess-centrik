import { useState, useRef, useEffect } from 'react'
import { Headphones, MessageCircle, Calendar, X } from 'lucide-react'
import { SOPORTE_WHATSAPP } from '@/lib/soporte'

const CALENDLY_URL = 'https://calendly.com/soporte-andres-santacruz/30min'

interface SupportMenuProps {
  collapsed: boolean
}

export function SupportMenu({ collapsed }: SupportMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-52 rounded-lg bg-white border border-gray-200 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-[10px] uppercase tracking-wider text-gray-400">Soporte</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          <a
            href={SOPORTE_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
          >
            <MessageCircle size={16} />
            <span className="text-sm font-medium">WhatsApp</span>
          </a>

          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-all"
          >
            <Calendar size={16} />
            <span className="text-sm font-medium">Agendar reunión</span>
          </a>
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        title={collapsed ? 'Soporte' : undefined}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-gray-300 hover:text-primary-600 hover:bg-primary-50 transition-all"
      >
        <Headphones size={18} />
        {!collapsed && <span className="text-[11px] font-medium">Soporte</span>}
      </button>
    </div>
  )
}
