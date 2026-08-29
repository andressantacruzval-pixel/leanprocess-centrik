import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Opcional: las pantallas de detalle llevan un boton "volver" en vez de icono. */
  icon?: LucideIcon
  /** Clases del recuadro del icono (fondo, borde). Cada pantalla conserva su color. */
  iconClass?: string
  /** Clases del icono en si (normalmente solo el `text-*`). */
  iconColor?: string
  /** Va antes del icono: el boton de volver de las pantallas de detalle. */
  leading?: ReactNode
  title: string
  /** Acepta JSX: en las fichas de proceso el subtitulo es un breadcrumb con iconos. */
  subtitle?: ReactNode
  /** Botones o controles de la derecha. Bajan de linea antes que aplastar el titulo. */
  actions?: ReactNode
}

/**
 * La cabecera de pantalla. Existe porque no existia: cada pagina construia la suya y
 * habian divergido en todo lo que se puede divergir —`text-xl` contra `text-2xl`, con
 * y sin `min-w-0`, con y sin `truncate`— y ninguna envolvia, asi que un titulo largo o
 * un boton ancho se comian el uno al otro en vez de repartirse en dos lineas.
 */
export function PageHeader({
  icon: Icon,
  iconClass = 'bg-primary-50',
  iconColor = 'text-primary-600',
  leading,
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {leading && <div className="shrink-0">{leading}</div>}
      {Icon && (
        <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${iconClass}`}>
          <Icon size={20} className={iconColor} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <div className="text-xs sm:text-sm text-gray-500 truncate">{subtitle}</div>}
      </div>
      {actions && <div className="shrink-0 ml-auto">{actions}</div>}
    </div>
  )
}
