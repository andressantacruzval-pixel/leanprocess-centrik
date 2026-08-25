import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Database, Layers, Box, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react'
import { STATE_COLORS, type JourneyNodeData } from './journeyGraph'

// Nodo del Data Journey: macroproceso / proceso / subproceso, con nº de activos,
// insignias de criticidad y de estados (creación / eliminación) y un botón para
// expandir o colapsar el nivel. El cuerpo es arrastrable; el chevron no.

function critColor(n: number): string {
  if (n >= 5) return '#ef4444'
  if (n === 4) return '#f97316'
  if (n === 3) return '#eab308'
  if (n >= 1) return '#10b981'
  return 'transparent'
}

const LEVEL_ICON = { macro: Layers, process: Box, subprocess: Database }

function JourneyNodeInner({ id, data }: NodeProps<JourneyNodeData>) {
  const Icon = LEVEL_ICON[data.level]
  const accent = critColor(data.critical)
  const bg = data.level === 'macro' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)'
  const border = data.level === 'macro' ? 'rgba(129,140,248,0.45)' : 'rgba(255,255,255,0.12)'

  return (
    <div
      style={{ width: data.width, height: data.height, background: bg, borderColor: border }}
      className="relative rounded-xl border flex items-center gap-2 px-2.5 shadow-lg shadow-black/30 backdrop-blur-sm"
      title={data.label}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#475569', width: 7, height: 7 }} />
      {/* Acento de criticidad */}
      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: accent }} />

      <Icon size={data.level === 'macro' ? 17 : 15} className="shrink-0 ml-1" color={data.level === 'macro' ? '#a5b4fc' : '#7dd3fc'} />

      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-white truncate leading-tight">{data.label}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-white/45">{data.count} activo{data.count === 1 ? '' : 's'}</span>
          {data.hasCrea && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS.crea }} title="Se crean datos aquí" />}
          {data.hasElimina && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS.elimina }} title="Se eliminan datos aquí" />}
          {data.personalData && <ShieldAlert size={10} className="text-amber-400" aria-label="Datos personales" />}
        </div>
      </div>

      {data.hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onToggle?.(id) }}
          className="shrink-0 nodrag p-1 rounded-md text-white/40 hover:text-cyan-300 hover:bg-white/10 transition-colors"
          title={data.expanded ? 'Colapsar' : 'Expandir'}
        >
          {data.expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      )}

      <Handle type="source" position={Position.Right} style={{ background: '#475569', width: 7, height: 7 }} />
    </div>
  )
}

export const JourneyNode = memo(JourneyNodeInner)
