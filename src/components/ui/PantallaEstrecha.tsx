import { MonitorSmartphone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  /** Qué necesita más ancho, en una frase. Ej.: "El diagramador BPMN". */
  que: string
  /** Por qué, en concreto. Se lee debajo del titular. */
  motivo: string
}

/**
 * Lo que se ve por debajo de `md` (768px) en las dos pantallas que no pueden funcionar
 * en un móvil: el editor BPMN y la reproducción de la presentación.
 *
 * Decir la verdad sale más barato que fingir. El diagramador crea elementos con
 * `onMouseDown` → `create.start` de diagram-js, y sus dos operaciones de edición son
 * dobles clics: no hay ancho que arregle eso. Mostrar un lienzo aplastado e inservible
 * se lee como una aplicación rota; esto se lee como un límite conocido.
 */
export function PantallaEstrecha({ que, motivo }: Props) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-14 h-14 rounded-lg bg-primary-50 border border-primary-200 flex items-center justify-center mb-4">
        <MonitorSmartphone size={26} className="text-primary-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900">{que} necesita una pantalla más ancha</h2>
      <p className="mt-2 max-w-xs text-sm text-gray-500 leading-relaxed">{motivo}</p>
      <button
        onClick={() => navigate(-1)}
        className="mt-6 px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
      >
        Volver
      </button>
    </div>
  )
}
