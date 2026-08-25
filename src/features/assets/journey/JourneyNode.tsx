import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Database, Layers, Box, FileText, ChevronDown, ChevronRight, ShieldAlert, SquarePen } from 'lucide-react'
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

const LEVEL_ICON = { macro: Layers, process: Box, subprocess: Database, asset: FileText, field: FileText }
const LEVEL_LABEL = { macro: 'Macroproceso', process: 'Proceso', subprocess: 'Subproceso', asset: 'Activo', field: 'Campo' }
const HIDDEN = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none', background: 'transparent', pointerEvents: 'none' as const }

function JourneyNodeInner({ id, data, selected }: NodeProps<JourneyNodeData>) {
  // Nodo de CAMPO (columna): compacto, con punto de color por tratamiento
  // (gris = no se envía).
  if (data.level === 'field') {
    return (
      <div style={{ width: data.width, height: data.height, borderLeft: `3px solid ${data.fieldColor ?? '#64748b'}`, cursor: 'pointer', opacity: data.dimmed ? 0.2 : 1 }}
        className="relative rounded-md border border-white/10 bg-white/[0.03] flex items-center gap-1.5 px-2 hover:border-white/25 transition-opacity" title={data.label}>
        <Handle id="in" type="target" position={Position.Top} isConnectable={false} style={HIDDEN} />
        <Handle id="tin" type="target" position={Position.Left} isConnectable={false} style={HIDDEN} />
        <span className="text-[10.5px] text-white/70 truncate">{data.label}</span>
        <Handle id="tout" type="source" position={Position.Right} isConnectable={false} style={HIDDEN} />
        <Handle id="out" type="source" position={Position.Bottom} isConnectable={false} style={HIDDEN} />
      </div>
    )
  }
  const Icon = LEVEL_ICON[data.level]
  const accent = critColor(data.critical)
  const cat = CATEGORY_META[data.category]?.color ?? '#334155'
  const isAsset = data.level === 'asset'
  const canReceive = data.level === 'process' || data.level === 'subprocess'
  const glow = data.connecting && canReceive
  const dim = data.connecting && data.level === 'macro'
  const bg = isAsset ? 'rgba(148,163,184,0.08)' : data.level === 'macro' ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)'
  const border = glow || selected ? '#22d3ee' : data.level === 'macro' ? 'rgba(129,140,248,0.45)' : 'rgba(255,255,255,0.12)'
  // Al seleccionar (clic), el nodo se agranda para leer el nombre completo.
  const width = selected ? Math.max(data.width, 250) : data.width

  return (
    <div
      style={{ width, height: selected ? 'auto' : data.height, minHeight: data.height, background: bg, borderColor: border, borderTop: `2px solid ${cat}`, boxShadow: glow ? '0 0 0 2px rgba(34,211,238,0.7), 0 0 16px rgba(34,211,238,0.5)' : selected ? '0 0 0 2px rgba(34,211,238,0.6)' : undefined, opacity: (dim ? 0.4 : 1) * (data.dimmed ? 0.22 : 1) }}
      className="relative rounded-xl border flex items-center gap-2 px-2.5 pt-2.5 pb-1.5 shadow-lg shadow-black/30 backdrop-blur-sm transition-all"
      title={data.label}
    >
      <span className="absolute -top-2 left-2.5 px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider text-white/70" style={{ background: '#0b1220', border: `1px solid ${cat}66` }}>{LEVEL_LABEL[data.level]}</span>
      {data.received && <span className="absolute -top-2 right-2.5 px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase tracking-wider text-cyan-200" style={{ background: '#0b1220', border: '1px solid rgba(34,211,238,0.4)' }} title={data.sourceName ? `Recibido de ${data.sourceName}` : 'Recibido'}>↙ Recibido</span>}
      {/* Handles de jerarquía (para las líneas del árbol) — invisibles, no conectables */}
      <Handle id="in" type="target" position={Position.Top} isConnectable={false} style={HIDDEN} />
      <Handle id="out" type="source" position={Position.Bottom} isConnectable={false} style={HIDDEN} />
      {/* Recepción de transferencias: solo procesos/subprocesos */}
      <Handle id="tin" type="target" position={Position.Left} isConnectable={canReceive} style={canReceive ? { background: '#22d3ee', width: 9, height: 9, border: '2px solid #0b1220' } : HIDDEN} />
      {/* Inicio de transferencia: solo activos */}
      <Handle id="tout" type="source" position={Position.Right} isConnectable={isAsset} style={isAsset ? { background: '#34d399', width: 9, height: 9, border: '2px solid #0b1220' } : HIDDEN} />

      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ background: accent }} />

      <Icon size={isAsset ? 13 : data.level === 'macro' ? 17 : 15} className="shrink-0 ml-1" color={isAsset ? '#cbd5e1' : data.level === 'macro' ? '#a5b4fc' : '#7dd3fc'} />

      <div className="min-w-0 flex-1 overflow-hidden">
        <p className={`${isAsset ? 'text-[11px]' : 'text-[12px]'} font-semibold text-white leading-tight ${selected ? 'whitespace-normal break-words' : 'truncate'}`}>{data.label}</p>
        <div className={`flex items-center gap-1.5 mt-0.5 ${selected ? 'flex-wrap' : 'overflow-hidden'}`}>
          {!isAsset && <span className="text-[9px] text-white/45 shrink-0">{data.count} activo{data.count === 1 ? '' : 's'}</span>}
          {isAsset && <span className="text-[9px] text-white/45 shrink-0">{data.fields ?? 0} campo{(data.fields ?? 0) === 1 ? '' : 's'}</span>}
          {isAsset && data.received && data.sourceName && <span className="text-[9px] text-cyan-300/80 truncate min-w-0">de {data.sourceName}</span>}
          {data.hasCrea && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATE_COLORS.crea }} title="Se crean datos aquí" />}
          {data.hasElimina && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATE_COLORS.elimina }} title="Se eliminan datos aquí" />}
          {data.personalData && <ShieldAlert size={10} className="text-amber-400 shrink-0" aria-label="Datos personales" />}
          {isAsset && data.critical > 0 && <span className="text-[8.5px] px-1 py-0.5 rounded text-white shrink-0" style={{ background: critColor(data.critical) }}>C·I·D {data.critical}</span>}
        </div>
      </div>

      {isAsset && !data.received && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onOpenForm?.(id) }}
          className="shrink-0 nodrag p-1 rounded-md text-white/25 hover:text-cyan-300 hover:bg-white/10 transition-colors"
          title="Abrir formulario del activo"
        >
          <SquarePen size={12} />
        </button>
      )}

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
