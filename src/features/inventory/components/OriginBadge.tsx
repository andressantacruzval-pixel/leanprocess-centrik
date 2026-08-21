import type { InvOrigen } from '../types'

// Etiqueta chiquita de origen: A = aceptado (confirmado), D = deducido por IA.
// Al pasar el mouse muestra el texto completo.

export function OriginBadge({ origen }: { origen: InvOrigen }) {
  const accepted = origen === 'confirmado'
  return (
    <span
      title={accepted ? 'Aceptado' : 'Deducido por IA'}
      className="inline-grid place-items-center w-4 h-4 rounded-[5px] text-[9px] font-black leading-none select-none"
      style={accepted
        ? { background: 'rgba(22,163,74,.16)', color: '#16a34a', border: '1px solid rgba(22,163,74,.35)' }
        : { background: 'rgba(217,119,6,.16)', color: '#d97706', border: '1px solid rgba(217,119,6,.35)' }}
    >
      {accepted ? 'A' : 'D'}
    </span>
  )
}
