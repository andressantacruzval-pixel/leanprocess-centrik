import { memo } from 'react'
import { type NodeProps } from 'reactflow'
import type { JourneyBandData } from './journeyGraph'

// Banda de categoría (estratégicos / cadena de valor / apoyo), como el mapa de
// procesos: franja tenue con etiqueta vertical a la izquierda. No interactiva.
function JourneyBandInner({ data }: NodeProps<JourneyBandData>) {
  return (
    <div
      style={{ width: data.width, height: data.height, background: `${data.color}0d`, borderColor: `${data.color}33` }}
      className="rounded-lg border flex overflow-hidden pointer-events-none"
    >
      <div style={{ background: data.color }} className="w-8 flex items-center justify-center shrink-0">
        <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }} className="text-gray-900 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          {data.label}
        </span>
      </div>
    </div>
  )
}

export const JourneyBand = memo(JourneyBandInner)
