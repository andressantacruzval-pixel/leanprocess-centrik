import dagre from 'dagre'
import { MarkerType, type Node, type Edge } from 'reactflow'
import type { Macroprocess, Process } from '@/types/process'
import type { InformationAsset } from '@/types/asset'
import type { AssetOperationRow } from '@/services/assets.service'

// ── Constructor del grafo del Data Journey ────────────────────────────────
// Convierte macroprocesos, procesos, subprocesos, activos y sus operaciones en
// nodos/aristas de ReactFlow con drill-down: se ve el flujo a nivel macro y,
// conforme se expande, aparecen procesos y subprocesos. Las aristas que quedan
// «dentro» de un nodo colapsado se agregan sobre el ancestro visible.

export const STATE_COLORS: Record<string, string> = {
  crea: '#10b981', usa: '#64748b', almacena: '#8b5cf6',
  transforma: '#f59e0b', transfiere: '#06b6d4', elimina: '#ef4444',
}
export const STATE_LABELS: Record<string, string> = {
  crea: 'Creación', usa: 'Uso', almacena: 'Almacenamiento',
  transforma: 'Transformación', transfiere: 'Transferencia', elimina: 'Eliminación',
}

export type JourneyLevel = 'macro' | 'process' | 'subprocess'

export interface JourneyNodeData {
  nodeId: string
  label: string
  level: JourneyLevel
  count: number
  hasChildren: boolean
  expanded: boolean
  critical: number
  personalData: boolean
  hasCrea: boolean
  hasElimina: boolean
  width: number
  height: number
  onToggle?: (id: string) => void
}

export interface BuildInput {
  macros: Macroprocess[]
  processes: Process[]
  assets: InformationAsset[]
  operations: AssetOperationRow[]
  expandedMacros: Set<string>
  expandedProcesses: Set<string>
  assetFilter: Set<string> | null
  stateFilter: Set<string>
}

const DIMS: Record<JourneyLevel, { width: number; height: number }> = {
  macro: { width: 210, height: 72 }, process: { width: 180, height: 60 }, subprocess: { width: 170, height: 56 },
}

export function buildJourney(input: BuildInput): { nodes: Node<JourneyNodeData>[]; edges: Edge[] } {
  const { macros, processes, assets, operations, expandedMacros, expandedProcesses, assetFilter, stateFilter } = input

  const procById = new Map(processes.map((p) => [p.id, p]))
  const childrenOf = new Map<string, Process[]>()
  const topOfMacro = new Map<string, Process[]>()
  for (const p of processes) {
    if (p.parent_process_id) {
      const arr = childrenOf.get(p.parent_process_id) ?? []; arr.push(p); childrenOf.set(p.parent_process_id, arr)
    } else if (p.macroprocess_id) {
      const arr = topOfMacro.get(p.macroprocess_id) ?? []; arr.push(p); topOfMacro.set(p.macroprocess_id, arr)
    }
  }

  // Cadena de ancestros [procesoRaíz…hoja] y macro de un proceso.
  const pathOf = (pid: string): string[] => {
    const chain: string[] = []
    const guard = new Set<string>()
    let cur = procById.get(pid)
    while (cur && !guard.has(cur.id)) {
      chain.unshift(cur.id); guard.add(cur.id)
      cur = cur.parent_process_id ? procById.get(cur.parent_process_id) : undefined
    }
    return chain
  }
  const macroOf = (pid: string): string | undefined => {
    const chain = pathOf(pid)
    return chain.length ? procById.get(chain[0])?.macroprocess_id : procById.get(pid)?.macroprocess_id
  }

  // Nodo visible que representa a un proceso (según lo expandido).
  const representative = (pid: string): string | null => {
    const macroId = macroOf(pid)
    if (!macroId) return null
    const tops = topOfMacro.get(macroId) ?? []
    if (!expandedMacros.has(macroId) || tops.length === 0) return `m:${macroId}`
    for (const step of pathOf(pid)) {
      const hasCh = (childrenOf.get(step)?.length ?? 0) > 0
      if (!(expandedProcesses.has(step) && hasCh)) return `p:${step}`
    }
    const chain = pathOf(pid)
    return chain.length ? `p:${chain[chain.length - 1]}` : null
  }

  // ── Nodos visibles (incluye estructura sin activos) ──────────────────────
  const visible = new Map<string, JourneyNodeData>()
  const addMacro = (m: Macroprocess) => {
    const hasCh = (topOfMacro.get(m.id)?.length ?? 0) > 0
    visible.set(`m:${m.id}`, {
      nodeId: `m:${m.id}`, label: m.name, level: 'macro', count: 0, hasChildren: hasCh,
      expanded: expandedMacros.has(m.id), critical: 0, personalData: false, hasCrea: false, hasElimina: false,
      ...DIMS.macro,
    })
  }
  const addProcess = (p: Process) => {
    const hasCh = (childrenOf.get(p.id)?.length ?? 0) > 0
    const level: JourneyLevel = p.parent_process_id ? 'subprocess' : 'process'
    visible.set(`p:${p.id}`, {
      nodeId: `p:${p.id}`, label: p.name, level, count: 0, hasChildren: hasCh,
      expanded: expandedProcesses.has(p.id), critical: 0, personalData: false, hasCrea: false, hasElimina: false,
      ...DIMS[level],
    })
  }
  const emitProcess = (p: Process) => {
    const ch = childrenOf.get(p.id) ?? []
    if (expandedProcesses.has(p.id) && ch.length) ch.forEach(emitProcess)
    else addProcess(p)
  }
  for (const m of macros) {
    const tops = topOfMacro.get(m.id) ?? []
    if (expandedMacros.has(m.id) && tops.length) tops.forEach(emitProcess)
    else addMacro(m)
  }

  // ── Agregados por nodo desde los activos (respetando el filtro) ──────────
  const passes = (assetId: string) => !assetFilter || assetFilter.has(assetId)
  for (const a of assets) {
    if (!passes(a.id) || !a.process_id) continue
    const rep = representative(a.process_id)
    if (!rep) continue
    const n = visible.get(rep)
    if (!n) continue
    n.count += 1
    n.critical = Math.max(n.critical, a.criticality || 0)
    if (a.has_personal_data) n.personalData = true
  }
  // Estados de ciclo de vida (crea/elimina) como insignias del nodo.
  for (const op of operations) {
    if (op.source_process_id || op.target_process_id) continue
    if (!passes(op.asset_id) || !op.process_id) continue
    const rep = representative(op.process_id)
    const n = rep ? visible.get(rep) : null
    if (!n) continue
    const st = (op.operation || '').toLowerCase()
    if (st.startsWith('crea') && stateFilter.has('crea')) n.hasCrea = true
    if (st.startsWith('elimina') && stateFilter.has('elimina')) n.hasElimina = true
  }

  // ── Aristas de transferencia (agregadas por par de nodos visibles) ───────
  const edgeMap = new Map<string, { from: string; to: string; assets: Set<string> }>()
  if (stateFilter.has('transfiere')) {
    for (const op of operations) {
      if (!op.source_process_id && !op.target_process_id) continue
      if (!passes(op.asset_id)) continue
      const home = op.process_id
      const fromPid = op.source_process_id || home
      const toPid = op.target_process_id || home
      if (!fromPid || !toPid) continue
      const from = representative(fromPid)
      const to = representative(toPid)
      if (!from || !to || from === to) continue
      if (!visible.has(from) || !visible.has(to)) continue
      const key = `${from}|${to}`
      const e = edgeMap.get(key) ?? { from, to, assets: new Set<string>() }
      e.assets.add(op.asset_id); edgeMap.set(key, e)
    }
  }

  // ── Filtro por activo: conservar solo lo que toca el/los activo(s) ───────
  let keep: Set<string> | null = null
  if (assetFilter) {
    keep = new Set<string>()
    edgeMap.forEach((e) => { keep!.add(e.from); keep!.add(e.to) })
    assets.forEach((a) => {
      if (passes(a.id) && a.process_id) { const r = representative(a.process_id); if (r) keep!.add(r) }
    })
  }

  const finalNodes = [...visible.values()].filter((n) => !keep || keep.has(n.nodeId))
  const finalIds = new Set(finalNodes.map((n) => n.nodeId))
  const finalEdges = [...edgeMap.values()].filter((e) => finalIds.has(e.from) && finalIds.has(e.to))

  // ── Layout con dagre (izquierda → derecha, sentido del flujo) ────────────
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 120, marginx: 20, marginy: 20 })
  finalNodes.forEach((n) => g.setNode(n.nodeId, { width: n.width, height: n.height }))
  finalEdges.forEach((e) => g.setEdge(e.from, e.to))
  dagre.layout(g)

  const nodes: Node<JourneyNodeData>[] = finalNodes.map((n) => {
    const pos = g.node(n.nodeId)
    return {
      id: n.nodeId,
      type: 'journeyNode',
      position: { x: (pos?.x ?? 0) - n.width / 2, y: (pos?.y ?? 0) - n.height / 2 },
      data: n,
    }
  })

  const color = STATE_COLORS.transfiere
  const edges: Edge[] = finalEdges.map((e) => {
    const count = e.assets.size
    const highlighted = !!assetFilter
    return {
      id: `${e.from}=>${e.to}`,
      source: e.from, target: e.to, type: 'default',
      animated: highlighted,
      label: String(count),
      labelBgPadding: [4, 2], labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#0b1220', fillOpacity: 0.85 },
      labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600 },
      style: { stroke: color, strokeWidth: Math.min(2 + count, 8), opacity: highlighted ? 1 : 0.75 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    }
  })

  return { nodes, edges }
}
