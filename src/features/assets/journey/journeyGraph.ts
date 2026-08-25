import { MarkerType, type Node, type Edge } from 'reactflow'
import type { Macroprocess, Process } from '@/types/process'
import type { InformationAsset } from '@/types/asset'
import type { AssetOperationRow } from '@/services/assets.service'

// ── Constructor del grafo del Data Journey ────────────────────────────────
// Jerarquía en árbol: al expandir, los hijos bajan DEBAJO del padre (el padre
// se queda). macroproceso → proceso → subproceso → activos. Cada nivel es más
// pequeño. Las bandas por categoría (estratégicos / cadena de valor / apoyo) se
// apilan como el mapa de procesos. Las flechas de transferencia se conectan al
// nivel que esté visible (el nodo más profundo mostrado).

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
  fields?: number
  connecting?: boolean
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
  macro: { width: 206, height: 68 }, process: { width: 168, height: 56 },
  subprocess: { width: 136, height: 52 }, asset: { width: 150, height: 40 },
}
const SLOT_W = 170, LEVEL_GAP_Y = 98, TREE_GAP = 56, BAND_GAP = 64, TOP_PAD = 34

interface V { id: string; data: JourneyNodeData; children: V[] }

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
  for (const a of assets) { if (a.process_id && passes(a.id)) { const arr = assetsByProc.get(a.process_id) ?? []; arr.push(a); assetsByProc.set(a.process_id, arr) } }
  const hasChildProcs = (pid: string) => (childrenOf.get(pid)?.length ?? 0) > 0
  const hasAssets = (pid: string) => (assetsByProc.get(pid)?.length ?? 0) > 0

  const pathOf = (pid: string): string[] => {
    const chain: string[] = []; const guard = new Set<string>(); let cur = procById.get(pid)
    while (cur && !guard.has(cur.id)) { chain.unshift(cur.id); guard.add(cur.id); cur = cur.parent_process_id ? procById.get(cur.parent_process_id) : undefined }
    return chain
  }
  const macroOf = (pid: string) => { const c = pathOf(pid); return c.length ? procById.get(c[0])?.macroprocess_id : procById.get(pid)?.macroprocess_id }

  // Nodo visible más profundo que representa a un proceso (al que se conectan las flechas).
  const representative = (pid: string): string | null => {
    const macroId = macroOf(pid); if (!macroId) return null
    if (!expandedMacros.has(macroId) || (topOfMacro.get(macroId)?.length ?? 0) === 0) return `m:${macroId}`
    let rep = `m:${macroId}`
    for (const step of pathOf(pid)) { rep = `p:${step}`; if (!expandedProcesses.has(step) || !hasChildProcs(step)) break }
    return rep
  }

  // Estadísticas por nodo: se acumulan sobre TODO el subárbol, así un proceso o
  // macroproceso muestra la SUMA de los activos de sus subprocesos (aunque esté
  // colapsado o expandido), no solo los suyos directos.
  const stat = new Map<string, { count: number; crit: number; pd: boolean; crea: boolean; elim: boolean }>()
  const ancestorsOf = (pid: string): string[] => {
    const ids = pathOf(pid).map((p) => `p:${p}`)
    const m = macroOf(pid); if (m) ids.push(`m:${m}`)
    return ids
  }
  const addTo = (id: string, fn: (s: { count: number; crit: number; pd: boolean; crea: boolean; elim: boolean }) => void) => {
    const s = stat.get(id) ?? { count: 0, crit: 0, pd: false, crea: false, elim: false }; stat.set(id, s); fn(s)
  }
  for (const a of assets) {
    if (!passes(a.id) || !a.process_id) continue
    ancestorsOf(a.process_id).forEach((id) => addTo(id, (s) => { s.count++; s.crit = Math.max(s.crit, a.criticality || 0); if (a.has_personal_data) s.pd = true }))
  }
  for (const op of operations) {
    if (op.source_process_id || op.target_process_id || !op.process_id || !passes(op.asset_id)) continue
    const st = (op.operation || '').toLowerCase()
    ancestorsOf(op.process_id).forEach((id) => addTo(id, (s) => {
      if (st.startsWith('crea') && stateFilter.has('crea')) s.crea = true
      if (st.startsWith('elimina') && stateFilter.has('elimina')) s.elim = true
    }))
  }
  const dataOf = (id: string, label: string, level: JourneyLevel, cat: Category, hasChildren: boolean, expanded: boolean, extra?: Partial<JourneyNodeData>): JourneyNodeData => {
    const s = stat.get(id)
    return { nodeId: id, label, level, category: cat, count: s?.count ?? 0, hasChildren, expanded, critical: s?.crit ?? 0, personalData: s?.pd ?? false, hasCrea: s?.crea ?? false, hasElimina: s?.elim ?? false, ...DIM[level], ...extra }
  }

  // ── Construcción del bosque (un árbol por macroproceso) ──────────────────
  const buildProc = (p: Process, cat: Category): V => {
    const level: JourneyLevel = p.parent_process_id ? 'subprocess' : 'process'
    const children: V[] = []
    if (expandedProcesses.has(p.id)) {
      if (hasChildProcs(p.id)) (childrenOf.get(p.id) ?? []).forEach((c) => children.push(buildProc(c, cat)))
      else (assetsByProc.get(p.id) ?? []).forEach((a) => children.push({ id: `a:${a.id}`, data: dataOf(`a:${a.id}`, a.name, 'asset', cat, false, false, { critical: a.criticality || 0, personalData: a.has_personal_data, fields: a.columns?.length ?? 0 }), children: [] }))
    }
    return { id: `p:${p.id}`, data: dataOf(`p:${p.id}`, p.name, level, cat, hasChildProcs(p.id) || hasAssets(p.id), expandedProcesses.has(p.id)), children }
  }
  const forest = sortedMacros.map((m) => {
    const children = expandedMacros.has(m.id) ? (topOfMacro.get(m.id) ?? []).map((p) => buildProc(p, m.category)) : []
    return { cat: m.category, root: { id: `m:${m.id}`, data: dataOf(`m:${m.id}`, m.name, 'macro', m.category, (topOfMacro.get(m.id)?.length ?? 0) > 0, expandedMacros.has(m.id)), children } as V }
  })

  // ── Aristas de transferencia ─────────────────────────────────────────────
  const edgeMap = new Map<string, { from: string; to: string; assets: Set<string> }>()
  if (stateFilter.has('transfiere')) {
    for (const op of operations) {
      if ((!op.source_process_id && !op.target_process_id) || !passes(op.asset_id)) continue
      const home = op.process_id
      const from = representative(op.source_process_id || home || ''); const to = representative(op.target_process_id || home || '')
      if (!from || !to || from === to) continue
      const key = `${from}|${to}`; const e = edgeMap.get(key) ?? { from, to, assets: new Set<string>() }
      e.assets.add(op.asset_id); edgeMap.set(key, e)
    }
  }

  // ── Filtro por activo: podar a lo relevante ──────────────────────────────
  let relevant: Set<string> | null = null
  if (assetFilter) {
    relevant = new Set<string>()
    edgeMap.forEach((e) => { relevant!.add(e.from); relevant!.add(e.to) })
    assets.forEach((a) => { if (passes(a.id) && a.process_id) { const r = representative(a.process_id); if (r) relevant!.add(r); relevant!.add(`a:${a.id}`) } })
  }
  const prune = (v: V): V | null => {
    const kids = v.children.map(prune).filter((c): c is V => !!c)
    if (!relevant || relevant.has(v.id) || kids.length > 0) return { ...v, children: kids }
    return null
  }
  const roots = forest.map((f) => ({ cat: f.cat, root: relevant ? prune(f.root) : f.root })).filter((f): f is { cat: Category; root: V } => !!f.root)

  // ── Layout: árbol de arriba a abajo, bandas apiladas ─────────────────────
  const nodes: Node[] = []; const bandNodes: Node[] = []; const edges: Edge[] = []
  let runningY = TOP_PAD
  const place = (v: V, depth: number, baseY: number, cursor: { x: number }, onDepth: (d: number) => void): number => {
    const y = baseY + depth * LEVEL_GAP_Y; onDepth(depth)
    let cx: number
    if (v.children.length === 0) { cx = cursor.x + SLOT_W / 2; cursor.x += SLOT_W }
    else { const xs = v.children.map((c) => place(c, depth + 1, baseY, cursor, onDepth)); cx = (xs[0] + xs[xs.length - 1]) / 2 }
    nodes.push({ id: v.id, type: 'journeyNode', position: { x: cx - v.data.width / 2, y }, data: v.data, draggable: true })
    v.children.forEach((c) => edges.push({ id: `h:${v.id}->${c.id}`, source: v.id, sourceHandle: 'out', target: c.id, targetHandle: 'in', type: 'smoothstep', style: { stroke: '#475569', strokeWidth: 1.4, opacity: 0.7 } }))
    return cx
  }
  for (const cat of CATEGORY_ORDER) {
    const band = roots.filter((r) => r.cat === cat)
    if (band.length === 0) continue
    const baseY = runningY; const cursor = { x: 0 }; let maxDepth = 0
    band.forEach((r) => { place(r.root, 0, baseY, cursor, (d) => { maxDepth = Math.max(maxDepth, d) }); cursor.x += TREE_GAP })
    const bandW = Math.max(cursor.x - TREE_GAP, SLOT_W); const bandH = (maxDepth + 1) * LEVEL_GAP_Y
    bandNodes.push({ id: `band:${cat}`, type: 'journeyBand', position: { x: -30, y: baseY - 16 }, data: { label: CATEGORY_META[cat].label, color: CATEGORY_META[cat].color, width: bandW + 44, height: bandH - LEVEL_GAP_Y + DIM.macro.height + 24 }, draggable: false, selectable: false, connectable: false, zIndex: 0 })
    runningY = baseY + bandH + BAND_GAP
  }

  // ── Flechas de transferencia entre nodos visibles ────────────────────────
  const color = STATE_COLORS.transfiere
  const nodeIds = new Set(nodes.map((n) => n.id))
  edgeMap.forEach((e) => {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return
    const count = e.assets.size
    edges.push({
      id: `t:${e.from}=>${e.to}`, source: e.from, sourceHandle: 'tout', target: e.to, targetHandle: 'tin', type: 'default', animated: !!assetFilter,
      label: String(count), labelBgPadding: [4, 2], labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#0b1220', fillOpacity: 0.85 }, labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600 },
      style: { stroke: color, strokeWidth: Math.min(2 + count, 8), opacity: assetFilter ? 1 : 0.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    })
  })

  return { nodes: [...bandNodes, ...nodes], edges }
}
