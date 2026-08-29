import { Loader2, Wand2 } from 'lucide-react'

interface DocSectionProps {
  number: string
  title: string
  field?: string
  improvingField?: string | null
  onImprove?: () => void
  children: React.ReactNode
}

export function DocSection({
  number,
  title,
  field,
  improvingField,
  onImprove,
  children,
}: DocSectionProps) {
  return (
    <div className="group/section">
      <div className="flex items-center gap-2 mb-3 border-b-2 border-blue-500 pb-1.5">
        <span className="text-blue-600 text-[15px] font-bold">{number}.</span>
        <h3 className="text-gray-900 text-[15px] font-bold uppercase tracking-wide flex-1">{title}</h3>

        {onImprove && (
          <button
            onClick={onImprove}
            disabled={improvingField === field}
            title="Mejorar con IA"
            /* `group-hover/section` no se dispara en tactil y esta era la unica via a
               la mejora con IA de la seccion. Mismo motivo que ACCIONES_AL_PASAR, con
               el grupo nombrado que usa este componente. */
            className="opacity-0 group-hover/section:opacity-100 pointer-coarse:opacity-100 p-2 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 transition-all"
          >
            {improvingField === field ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      <div>{children}</div>
    </div>
  )
}
