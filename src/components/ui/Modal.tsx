import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

const ANCHOS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
} as const

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Icono a la izquierda del titulo, ya renderizado. */
  icon?: ReactNode
  subtitle?: ReactNode
  size?: keyof typeof ANCHOS
  /** Botonera inferior. Envuelve sola si no cabe. */
  footer?: ReactNode
  children: ReactNode
  /** Desactiva el cierre por fondo y por Escape (confirmaciones destructivas). */
  persistente?: boolean
}

/**
 * El diálogo de la aplicación.
 *
 * Existía el patrón, no el componente: 25 modales lo reimplementaban cada uno por su
 * cuenta y habían divergido en las tres cosas que importan. Ocho no tenían tope de
 * altura, así que en una pantalla baja —o en un móvil apaisado— el contenido se
 * cortaba y no había forma de llegar al botón de aceptar. Tres no tenían margen
 * lateral y tocaban los bordes. Y dos llevaban ancho fijo (`w-[400px]`, `w-[380px]`),
 * más anchos que un iPhone SE.
 *
 * Las tres reglas que fija, y que no se negocian por modal:
 *   overlay `p-4`      → siempre hay margen contra los bordes de la pantalla
 *   `max-h-[85vh]`     → el diálogo nunca es más alto que la ventana
 *   cuerpo `flex-1 overflow-y-auto` → lo que sobra se desplaza; cabecera y pie se quedan
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  subtitle,
  size = 'md',
  footer,
  children,
  persistente = false,
}: ModalProps) {
  useEffect(() => {
    if (!open || persistente) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [open, persistente, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/45"
      onClick={persistente ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${ANCHOS[size]} max-h-[85vh] flex flex-col bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden`}
      >
        {(title || icon) && (
          <div className="shrink-0 flex items-start gap-3 px-5 py-4 border-b border-gray-100">
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              {title && <h2 className="text-gray-900 font-semibold text-base truncate">{title}</h2>}
              {subtitle && <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 -m-2 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
