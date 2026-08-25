import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Database, Layers, Box, FileText, ChevronDown, ChevronRight, ShieldAlert } from 'lucide-react'
import { STATE_COLORS, CATEGORY_META, type JourneyNodeData } from './journeyGraph'

// Nodo del Data Journey: macroproceso / proceso / subproceso / activo. Solo los
// ACTIVOS pueden iniciar una conexión (punto derecho verde) y solo los procesos/
// subprocesos pueden recibirla (punto izquierdo cian). Macroprocesos no conectan.
// Al conectar desde un activo, los destinos válidos se resaltan.

function critColor(n: number): string {
  if (n >= 5) return '#ef4444'
  if (n === 4) return '#f97316'
  if (n === 3) return '#eab308'
  if (n >= 1) return '#10b981'
  return 'transparent'
}

const LEVEL_ICON = { macro: Layers, process: Box, subprocess: Database, asset: FileText }
const HIDDEN = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', pointerEvents: 'none' as const }

function JourneyNodeInner({ id, data }: NodeProps<JourneyNodeData>) {
  const Icon = LEVEL_ICON[data.level]
  const accent = critColor(data.critical)
  const cat = CATEGORY_META[data.category]?.color ?? '#334155'
  const isAsset = data.level === 'asset'
  const canReceive = data.level === 'process' || data.level === 'subprocess'
  const glow = data.connecting && canReceive
  const dim = data.connecting && data.level === 'macro'
  const bg = isAsset ? 'rgba(148,163,184,0.08)' : data.level === 'macro' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)'
  const border = glow ? '#22d3ee' : data.level === 'macro' ? 'rgba(129,140,248,0.45)' : 'rgba(255,255,255,0.12)'

  return (
    <div
      style={{ width: data.width, height: data.height, background: bg, borderColor: border, borderTop: `2px solid ${cat}`, boxShadow: glow ? '0 0 0 2px rgba(34,211,238,0.7), 0 0 16px rgba(34,211,238,0.5)' : undefined, opacity: dim ? 0.4 : 1 }}
      className="relative rounded-xl border flex items-center gap-2 px-2.5 shadow-lg shadow-black/30 backdrop-blur-sm transition-all"
      title={data.label}
    >
      {/* Handles de jerarquía (para las líneas del árbol) — invisibles, no conectables */}
      <Handle id="in" type="target" position={Position.Top} isConnectable={false} style={HIDDEN} />
      <Handle id="out" type="source" position={Position.Bottom} isConnectable={false} style={HIDDEN} />
      {/* Recepción de transferencias: solo procesos/subprocesos */}
      <Handle id="tin" type="target" position={Position.Left} isConnectable={canReceive} style={canReceive ? { background: '#22d3ee', width: 9, height: 9, border: '2px solid #0b1220' } : HIDDEN} />
      {/* Inicio de transferencia: solo activos */}
      <Handle id="tout" type="source" position={Position.Right} isConnectable={isAsset} style={isAsset ? { background: '#34d399', width: 9, height: 9, border: '2px solid #0b1220' } : HIDDEN} />

      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: accent }} />

      <Icon size={isAsset ? 13 : data.level === 'macro' ? 17 : 15} className="shrink-0 ml-1" color={isAsset ? '#cbd5e1' : data.level === 'macro' ? '#a5b4fc' : '#7dd3fc'} />

      <div className="min-w-0 flex-1">
        <p className={`${isAsset ? 'text-[11px]' : 'text-[12px]'} font-semibold text-white truncate leading-tight`}>{data.label}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {!isAsset && <span className="text-[9px] text-white/45">{data.count} activo{data.count === 1 ? '' : 's'}</span>}
          {isAsset && <span className="text-[9px] text-white/45">{data.fields ?? 0} campo{(data.fields ?? 0) === 1 ? '' : 's'}</span>}
          {data.hasCrea && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS.crea }} title="Se crean datos aquí" />}
          {data.hasElimina && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS.elimina }} title="Se eliminan datos aquí" />}
          {data.personalData && <ShieldAlert size={10} className="text-amber-400" aria-label="Datos personales" />}
          {isAsset && data.critical > 0 && <span className="text-[8.5px] px-1 py-0.5 rounded text-white" style={{ background: critColor(data.critical) }}>C·I·D {data.critical}</span>}
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
    </div>
  )
}

export const JourneyNode = memo(JourneyNodeInner)
