import { MarkerType, type Node, type Edge } from 'reactflow'
import type { Macroprocess, Process } from '@/types/process'
import type { InformationAsset } from '@/types/asset'
import type { AssetOperationRow } from '@/services/assets.service'

// ── Constructor del grafo del Data Journey ────────────────────────────────
// Se dibuja como el mapa de procesos: bandas por categoría (estratégicos arriba,
// cadena de valor en medio, apoyo abajo), ordenadas de izquierda a derecha. El
// drill-down encadena macroproceso → proceso → subproceso → activos dentro.

export const STATE_COLORS: Record<string, string> = {
  crea: '#10b981', usa: '#64748b', almacena: '#8b5cf6',
  transforma: '#f59e0b', transfiere: '#06b6d4', elimina: '#ef4444',
}
export const STATE_LABELS: Record<string, string> = {
  crea: 'Creación', usa: 'Uso', almacena: 'Almacenamiento',
  transforma: 'Transformación', transfiere: 'Transferencia', elimina: 'Eliminación',
}

type Category = 'estrategico' | 'productivo' | 'apoyo'
const CATEGORY_ORDER: Category[] = ['estrategico', 'productivo', 'apoyo']
export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  estrategico: { label: 'Estratégicos', color: '#DC2626' },
  productivo: { label: 'Cadena de valor', color: '#0891b2' },
  apoyo: { label: 'Apoyo', color: '#7C3AED' },
}

export type JourneyLevel = 'macro' | 'process' | 'subprocess' | 'asset'

export interface JourneyNodeData {
  nodeId: string
  label: string
  level: JourneyLevel
  category: Category
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
export interface JourneyBandData { label: string; color: string; width: number; height: number }

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

const DIM = {
  macro: { width: 210, height: 64 }, process: { width: 190, height: 58 },
  subprocess: { width: 176, height: 54 }, asset: { width: 168, height: 42 },
}
const COL_W = 252, ROW_H = 78, ASSET_STEP = 50, BAND_GAP = 70, TOP_PAD = 34

export function buildJourney(input: BuildInput): { nodes: Node[]; edges: Edge[] } {
  const { macros, processes, assets, operations, expandedMacros, expandedProcesses, assetFilter, stateFilter } = input

  const procById = new Map(processes.map((p) => [p.id, p]))
  const childrenOf = new Map<string, Process[]>()
  const topOfMacro = new Map<string, Process[]>()
  for (const p of processes) {
    if (p.parent_process_id) { const a = childrenOf.get(p.parent_process_id) ?? []; a.push(p); childrenOf.set(p.parent_process_id, a) }
    else if (p.macroprocess_id) { const a = topOfMacro.get(p.macroprocess_id) ?? []; a.push(p); topOfMacro.set(p.macroprocess_id, a) }
  }
  const bySort = (a: Process, b: Process) => a.sort_order - b.sort_order
  childrenOf.forEach((a) => a.sort(bySort)); topOfMacro.forEach((a) => a.sort(bySort))
  const sortedMacros = [...macros].sort((a, b) => a.sort_order - b.sort_order)

  const passes = (id: string) => !assetFilter || assetFilter.has(id)
  const assetsByProc = new Map<string, InformationAsset[]>()
  for (const a of assets) {
    if (!a.process_id || !passes(a.id)) continue
    const arr = assetsByProc.get(a.process_id) ?? []; arr.push(a); assetsByProc.set(a.process_id, arr)
  }
  const hasChildProcs = (pid: string) => (childrenOf.get(pid)?.length ?? 0) > 0
  const hasAssets = (pid: string) => (assetsByProc.get(pid)?.length ?? 0) > 0

  const pathOf = (pid: string): string[] => {
    const chain: string[] = []; const guard = new Set<string>(); let cur = procById.get(pid)
    while (cur && !guard.has(cur.id)) { chain.unshift(cur.id); guard.add(cur.id); cur = cur.parent_process_id ? procById.get(cur.parent_process_id) : undefined }
    return chain
  }
  const macroOf = (pid: string) => { const c = pathOf(pid); return c.length ? procById.get(c[0])?.macroprocess_id : procById.get(pid)?.macroprocess_id }

  // Nodo visible que representa a un proceso. «Reemplazar» solo ocurre cuando el
  // nodo tiene subprocesos hijos; un subproceso expandido a activos sigue visible.
  const representative = (pid: string): string | null => {
    const macroId = macroOf(pid); if (!macroId) return null
    if (!expandedMacros.has(macroId) || (topOfMacro.get(macroId)?.length ?? 0) === 0) return `m:${macroId}`
    for (const step of pathOf(pid)) if (!(expandedProcesses.has(step) && hasChildProcs(step))) return `p:${step}`
    const c = pathOf(pid); return c.length ? `p:${c[c.length - 1]}` : null
  }

  // ── Nodos visibles, en orden jerárquico y agrupados por banda ────────────
  const visible = new Map<string, JourneyNodeData>()
  const bandItems: Record<Category, string[]> = { estrategico: [], productivo: [], apoyo: [] }
  const push = (id: string, d: JourneyNodeData, cat: Category) => { visible.set(id, d); bandItems[cat].push(id) }

  const addMacro = (m: Macroprocess) => push(`m:${m.id}`, {
    nodeId: `m:${m.id}`, label: m.name, level: 'macro', category: m.category, count: 0,
    hasChildren: (topOfMacro.get(m.id)?.length ?? 0) > 0, expanded: expandedMacros.has(m.id),
    critical: 0, personalData: false, hasCrea: false, hasElimina: false, ...DIM.macro,
  }, m.category)
  const addProcess = (p: Process, cat: Category) => {
    const level: JourneyLevel = p.parent_process_id ? 'subprocess' : 'process'
    push(`p:${p.id}`, {
      nodeId: `p:${p.id}`, label: p.name, level, category: cat, count: 0,
      hasChildren: hasChildProcs(p.id) || hasAssets(p.id), expanded: expandedProcesses.has(p.id),
      critical: 0, personalData: false, hasCrea: false, hasElimina: false, ...DIM[level],
    }, cat)
  }
  const emitProcess = (p: Process, cat: Category) => {
    if (expandedProcesses.has(p.id) && hasChildProcs(p.id)) (childrenOf.get(p.id) ?? []).forEach((c) => emitProcess(c, cat))
    else addProcess(p, cat)
  }
  for (const m of sortedMacros) {
    const tops = topOfMacro.get(m.id) ?? []
    if (expandedMacros.has(m.id) && tops.length) tops.forEach((p) => emitProcess(p, m.category))
    else addMacro(m)
  }

  // Agregados por nodo (nº de activos, criticidad, datos personales).
  for (const a of assets) {
    if (!passes(a.id) || !a.process_id) continue
    const rep = representative(a.process_id); const n = rep ? visible.get(rep) : null
    if (!n) continue
    n.count += 1; n.critical = Math.max(n.critical, a.criticality || 0); if (a.has_personal_data) n.personalData = true
  }
  for (const op of operations) {
    if (op.source_process_id || op.target_process_id || !op.process_id || !passes(op.asset_id)) continue
    const rep = representative(op.process_id); const n = rep ? visible.get(rep) : null; if (!n) continue
    const st = (op.operation || '').toLowerCase()
    if (st.startsWith('crea') && stateFilter.has('crea')) n.hasCrea = true
    if (st.startsWith('elimina') && stateFilter.has('elimina')) n.hasElimina = true
  }

  // ── Activos «dentro» de un subproceso expandido (4º nivel) ───────────────
  const satellitesOf = new Map<string, JourneyNodeData[]>()
  for (const [cat, ids] of Object.entries(bandItems) as [Category, string[]][]) {
    for (const id of ids) {
      if (!id.startsWith('p:')) continue
      const pid = id.slice(2)
      if (!(expandedProcesses.has(pid) && !hasChildProcs(pid) && hasAssets(pid))) continue
      const sats = (assetsByProc.get(pid) ?? []).map<JourneyNodeData>((a) => ({
        nodeId: `a:${a.id}`, label: a.name, level: 'asset', category: cat, count: 0,
        hasChildren: false, expanded: false, critical: a.criticality || 0, personalData: a.has_personal_data,
        hasCrea: false, hasElimina: false, ...DIM.asset,
      }))
      satellitesOf.set(id, sats)
    }
  }

  // ── Aristas de transferencia ─────────────────────────────────────────────
  const edgeMap = new Map<string, { from: string; to: string; assets: Set<string> }>()
  if (stateFilter.has('transfiere')) {
    for (const op of operations) {
      if ((!op.source_process_id && !op.target_process_id) || !passes(op.asset_id)) continue
      const home = op.process_id
      const from = representative(op.source_process_id || home || ''); const to = representative(op.target_process_id || home || '')
      if (!from || !to || from === to || !visible.has(from) || !visible.has(to)) continue
      const key = `${from}|${to}`; const e = edgeMap.get(key) ?? { from, to, assets: new Set<string>() }
      e.assets.add(op.asset_id); edgeMap.set(key, e)
    }
  }

  // ── Filtro por activo: conservar solo lo que toca ────────────────────────
  let keep: Set<string> | null = null
  if (assetFilter) {
    keep = new Set<string>()
    edgeMap.forEach((e) => { keep!.add(e.from); keep!.add(e.to) })
    assets.forEach((a) => { if (passes(a.id) && a.process_id) { const r = representative(a.process_id); if (r) keep!.add(r) } })
  }
  const kept = (id: string) => !keep || keep.has(id)

  // ── Layout en bandas (izquierda→derecha, como el mapa de procesos) ───────
  const nodes: Node[] = []
  const bandNodes: Node[] = []
  let runningY = TOP_PAD
  for (const cat of CATEGORY_ORDER) {
    const ids = bandItems[cat].filter(kept)
    if (ids.length === 0) continue
    const baseY = runningY
    let maxSat = 0
    ids.forEach((id, i) => {
      const d = visible.get(id)!
      const x = i * COL_W + (COL_W - d.width) / 2
      nodes.push({ id, type: 'journeyNode', position: { x, y: baseY }, data: d, draggable: true })
      const sats = (satellitesOf.get(id) ?? []).filter((s) => !assetFilter || assetFilter.has(s.nodeId.slice(2)))
      maxSat = Math.max(maxSat, sats.length)
      sats.forEach((s, k) => {
        nodes.push({ id: s.nodeId, type: 'journeyNode', position: { x: i * COL_W + (COL_W - s.width) / 2, y: baseY + ROW_H + k * ASSET_STEP }, data: s, draggable: true })
      })
    })
    const contentH = ROW_H - 14 + (maxSat > 0 ? 14 + maxSat * ASSET_STEP : 0)
    bandNodes.push({
      id: `band:${cat}`, type: 'journeyBand', position: { x: -28, y: baseY - 14 },
      data: { label: CATEGORY_META[cat].label, color: CATEGORY_META[cat].color, width: ids.length * COL_W + 16, height: contentH + 24 },
      draggable: false, selectable: false, connectable: false, zIndex: 0,
    })
    runningY = baseY + contentH + BAND_GAP
  }

  // ── Aristas finales ──────────────────────────────────────────────────────
  const color = STATE_COLORS.transfiere
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges: Edge[] = []
  edgeMap.forEach((e) => {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return
    const count = e.assets.size
    edges.push({
      id: `${e.from}=>${e.to}`, source: e.from, target: e.to, type: 'default', animated: !!assetFilter,
      label: String(count), labelBgPadding: [4, 2], labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#0b1220', fillOpacity: 0.85 }, labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600 },
      style: { stroke: color, strokeWidth: Math.min(2 + count, 8), opacity: assetFilter ? 1 : 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    })
  })
  // Aristas de contención subproceso → activo (línea punteada, sin flecha).
  satellitesOf.forEach((sats, parentId) => {
    if (!nodeIds.has(parentId)) return
    sats.forEach((s) => {
      if (!nodeIds.has(s.nodeId)) return
      edges.push({ id: `c:${parentId}->${s.nodeId}`, source: parentId, target: s.nodeId, type: 'default', style: { stroke: '#475569', strokeWidth: 1.2, strokeDasharray: '4 4', opacity: 0.6 } })
    })
  })

  return { nodes: [...bandNodes, ...nodes], edges }
}
