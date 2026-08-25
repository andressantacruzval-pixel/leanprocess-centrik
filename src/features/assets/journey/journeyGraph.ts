import { MarkerType, type Node, type Edge } from 'reactflow'
import type { Macroprocess, Process } from '@/types/process'
import type { InformationAsset, AssetColumn } from '@/types/asset'
import type { AssetOperationRow } from '@/services/assets.service'
import { columnsAvailableAt } from './assetLifecycle'

// Detalle de un enlace de transferencia (para el modal al hacer clic en la flecha).
export interface JourneyEdgeLink {
  opId: string
  assetId: string
  assetName: string
  assetColumns: AssetColumn[]
  columns: AssetColumn[]
  justification: string
  destOperation?: string
  medium?: string
  mediumDetail?: string
}

// ── Constructor del grafo del Data Journey ────────────────────────────────
// Jerarquía en árbol: al expandir, los hijos bajan DEBAJO del padre (el padre
// se queda). macroproceso → proceso → subproceso → activos. Cada nivel es más
// pequeño. Las bandas por categoría (estratégicos / cadena de valor / apoyo) se
// apilan como el mapa de procesos. Las flechas de transferencia se conectan al
// nivel que esté visible (el nodo más profundo mostrado).

export const STATE_COLORS: Record<string, string> = {
  capta: '#14b8a6', crea: '#10b981', usa: '#64748b', almacena: '#8b5cf6',
  transforma: '#f59e0b', transfiere: '#06b6d4', elimina: '#ef4444',
}
export const STATE_LABELS: Record<string, string> = {
  capta: 'Obtención', crea: 'Creación', usa: 'Uso', almacena: 'Almacenamiento',
  transforma: 'Transformación', transfiere: 'Transferencia', elimina: 'Eliminación',
}

type Category = 'estrategico' | 'productivo' | 'apoyo'
const CATEGORY_ORDER: Category[] = ['estrategico', 'productivo', 'apoyo']
export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  estrategico: { label: 'Estratégicos', color: '#DC2626' },
  productivo: { label: 'Productivos', color: '#0891b2' },
  apoyo: { label: 'Apoyos', color: '#7C3AED' },
}

export type JourneyLevel = 'macro' | 'process' | 'subprocess' | 'asset' | 'field'

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
  received?: boolean
  sourceName?: string
  fieldColor?: string
  connecting?: boolean
  selected?: boolean
  dimmed?: boolean
  onToggle?: (id: string) => void
  onOpenForm?: (id: string) => void
}
export interface JourneyBandData { label: string; color: string; width: number; height: number }

export interface BuildInput {
  macros: Macroprocess[]
  processes: Process[]
  assets: InformationAsset[]
  operations: AssetOperationRow[]
  expandedMacros: Set<string>
  expandedProcesses: Set<string>
  expandedAssets: Set<string>
  assetFilter: Set<string> | null
  stateFilter: Set<string>
}

const DIM = {
  macro: { width: 206, height: 68 }, process: { width: 172, height: 58 },
  subprocess: { width: 150, height: 56 }, asset: { width: 176, height: 54 }, field: { width: 158, height: 32 },
}
const SLOT_W = 190, LEVEL_GAP_Y = 100, TREE_GAP = 56, BAND_GAP = 64, TOP_PAD = 34

interface V { id: string; data: JourneyNodeData; children: V[] }

export function buildJourney(input: BuildInput): { nodes: Node[]; edges: Edge[] } {
  const { macros, processes, assets, operations, expandedMacros, expandedProcesses, expandedAssets, assetFilter, stateFilter } = input
  const assetMap = new Map(assets.map((a) => [a.id, a]))

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

  // Activos RECIBIDOS por proceso (llegan por transferencia desde otro proceso).
  const receivedByProc = new Map<string, { op: AssetOperationRow; asset: InformationAsset }[]>()
  // Columnas «enviadas» por activo (para pintar en gris las que no viajan).
  const sentByAsset = new Map<string, Set<string>>()
  for (const op of operations) {
    if (!passes(op.asset_id)) continue
    const a = assetMap.get(op.asset_id)
    if (op.target_process_id && a) { const arr = receivedByProc.get(op.target_process_id) ?? []; arr.push({ op, asset: a }); receivedByProc.set(op.target_process_id, arr) }
    if (op.source_process_id || op.target_process_id) {
      const set = sentByAsset.get(op.asset_id) ?? new Set<string>(); (op.columns ?? []).forEach((c) => set.add(c.name)); sentByAsset.set(op.asset_id, set)
    }
  }
  const hasReceived = (pid: string) => (receivedByProc.get(pid)?.length ?? 0) > 0

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
  // Los activos recibidos también cuentan en el proceso destino (y sus ancestros).
  receivedByProc.forEach((arr, pid) => {
    ancestorsOf(pid).forEach((id) => addTo(id, (s) => { arr.forEach(({ asset }) => { s.count++; s.crit = Math.max(s.crit, asset.criticality || 0); if (asset.has_personal_data) s.pd = true }) }))
  })
  const dataOf = (id: string, label: string, level: JourneyLevel, cat: Category, hasChildren: boolean, expanded: boolean, extra?: Partial<JourneyNodeData>): JourneyNodeData => {
    const s = stat.get(id)
    return { nodeId: id, label, level, category: cat, count: s?.count ?? 0, hasChildren, expanded, critical: s?.crit ?? 0, personalData: s?.pd ?? false, hasCrea: s?.crea ?? false, hasElimina: s?.elim ?? false, ...DIM[level], ...extra }
  }

  // ── Construcción del bosque (un árbol por macroproceso) ──────────────────
  // Nodo de activo con expansión opcional a sus columnas (nivel «campo»),
  // coloreadas por su tratamiento (gris si esa columna no se envía).
  const assetNode = (a: InformationAsset, cat: Category, opts?: { received?: boolean; opId?: string; sourceName?: string; cols?: AssetColumn[] }): V => {
    const nodeId = opts?.received ? `r:${opts.opId}` : `a:${a.id}`
    // Recibido → solo las columnas que realmente llegaron (op.columns).
    const cols = opts?.received ? (opts.cols ?? []) : (a.columns ?? [])
    const expanded = expandedAssets.has(nodeId)
    const children: V[] = expanded ? cols.map((c, idx) => {
      const sent = opts?.received ? true : sentByAsset.get(a.id)?.has(c.name)
      const fcolor = !sent ? '#64748b' : (c.operation ? (STATE_COLORS[c.operation] ?? '#06b6d4') : '#06b6d4')
      const fid = `${nodeId}::f${idx}`
      return { id: fid, data: dataOf(fid, c.code ? `${c.code} · ${c.name}` : c.name, 'field', cat, false, false, { fieldColor: fcolor }), children: [] }
    }) : []
    return { id: nodeId, data: dataOf(nodeId, a.name, 'asset', cat, cols.length > 0, expanded, { critical: a.criticality || 0, personalData: a.has_personal_data, fields: cols.length, received: opts?.received, sourceName: opts?.sourceName }), children }
  }
  const buildProc = (p: Process, cat: Category): V => {
    const level: JourneyLevel = p.parent_process_id ? 'subprocess' : 'process'
    const children: V[] = []
    if (expandedProcesses.has(p.id)) {
      if (hasChildProcs(p.id)) (childrenOf.get(p.id) ?? []).forEach((c) => children.push(buildProc(c, cat)))
      else {
        (assetsByProc.get(p.id) ?? []).forEach((a) => children.push(assetNode(a, cat)))
        ;(receivedByProc.get(p.id) ?? []).forEach(({ op, asset }) => children.push(assetNode(asset, cat, { received: true, opId: op.id, sourceName: procById.get(op.process_id || '')?.name, cols: op.columns ?? [] })))
      }
    }
    return { id: `p:${p.id}`, data: dataOf(`p:${p.id}`, p.name, level, cat, hasChildProcs(p.id) || hasAssets(p.id) || hasReceived(p.id), expandedProcesses.has(p.id)), children }
  }
  const forest = sortedMacros.map((m) => {
    const children = expandedMacros.has(m.id) ? (topOfMacro.get(m.id) ?? []).map((p) => buildProc(p, m.category)) : []
    return { cat: m.category, root: { id: `m:${m.id}`, data: dataOf(`m:${m.id}`, m.name, 'macro', m.category, (topOfMacro.get(m.id)?.length ?? 0) > 0, expandedMacros.has(m.id)), children } as V }
  })

  // ── Aristas de transferencia ─────────────────────────────────────────────
  // Origen de la flecha = nodo visible más profundo del activo: subproceso o, si
  // el subproceso está expandido a activos, el propio nodo del activo.
  const sourceRep = (assetId: string, home: string | null): string | null => {
    if (home && expandedProcesses.has(home) && !hasChildProcs(home) && (assetsByProc.get(home)?.some((a) => a.id === assetId))) return `a:${assetId}`
    return representative(home || '')
  }
  const edgeMap = new Map<string, { from: string; to: string; assets: Set<string>; links: JourneyEdgeLink[] }>()
  // Aristas a nivel de campo: cuando el activo está expandido, la flecha sale de
  // cada columna enviada, no del activo, para ver qué columna va a qué proceso.
  const fieldEdges: { from: string; to: string; color: string; label: string }[] = []
  if (stateFilter.has('transfiere')) {
    for (const op of operations) {
      if ((!op.source_process_id && !op.target_process_id) || !passes(op.asset_id)) continue
      const home = op.process_id
      const from = op.target_process_id ? sourceRep(op.asset_id, home) : representative(op.source_process_id || home || '')
      const to = op.target_process_id ? representative(op.target_process_id) : representative(home || '')
      if (!from || !to || from === to) continue
      const a = assetMap.get(op.asset_id)
      // Si el activo origen está expandido a campos, una flecha por columna enviada.
      if (op.target_process_id && from === `a:${op.asset_id}` && expandedAssets.has(from) && a) {
        (op.columns ?? []).forEach((c) => {
          const idx = (a.columns ?? []).findIndex((x) => x.name === c.name)
          if (idx < 0) return
          fieldEdges.push({ from: `${from}::f${idx}`, to, color: c.operation ? (STATE_COLORS[c.operation] ?? STATE_COLORS.transfiere) : STATE_COLORS.transfiere, label: c.name })
        })
        continue
      }
      const key = `${from}|${to}`; const e = edgeMap.get(key) ?? { from, to, assets: new Set<string>(), links: [] }
      e.assets.add(op.asset_id)
      // La lista de columnas seleccionables es la DISPONIBLE en el origen del enlace
      // (todas si sale del proceso del activo; solo las recibidas si es encadenado).
      const available = a ? columnsAvailableAt(a, op.process_id, operations) : []
      e.links.push({ opId: op.id, assetId: op.asset_id, assetName: a?.name ?? 'Activo', assetColumns: available, columns: op.columns ?? [], justification: op.justification ?? '', destOperation: op.dest_operation, medium: op.medium, mediumDetail: op.medium_detail })
      edgeMap.set(key, e)
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
  // LEFT_PAD deja libre la franja de la etiqueta vertical (la banda arranca en
  // x=0 con su franja de color de ~32px; el contenido empieza más a la derecha
  // para no taparla). Todas las bandas se pintan del ANCHO de la más larga.
  const LEFT_PAD = 64
  const nodes: Node[] = []; const edges: Edge[] = []
  let runningY = TOP_PAD; let maxRight = SLOT_W
  const place = (v: V, depth: number, baseY: number, cursor: { x: number }, onDepth: (d: number) => void): number => {
    const y = baseY + depth * LEVEL_GAP_Y; onDepth(depth)
    let cx: number
    if (v.children.length === 0) { cx = cursor.x + SLOT_W / 2; cursor.x += SLOT_W }
    else { const xs = v.children.map((c) => place(c, depth + 1, baseY, cursor, onDepth)); cx = (xs[0] + xs[xs.length - 1]) / 2 }
    nodes.push({ id: v.id, type: 'journeyNode', position: { x: cx - v.data.width / 2, y }, data: v.data, draggable: true })
    v.children.forEach((c) => edges.push({ id: `h:${v.id}->${c.id}`, source: v.id, sourceHandle: 'out', target: c.id, targetHandle: 'in', type: 'smoothstep', style: { stroke: '#475569', strokeWidth: 1.4, opacity: 0.7 } }))
    return cx
  }
  const bandMeta: { cat: Category; baseY: number; height: number }[] = []
  for (const cat of CATEGORY_ORDER) {
    const band = roots.filter((r) => r.cat === cat)
    if (band.length === 0) continue
    const baseY = runningY; const cursor = { x: LEFT_PAD }; let maxDepth = 0
    band.forEach((r) => { place(r.root, 0, baseY, cursor, (d) => { maxDepth = Math.max(maxDepth, d) }); cursor.x += TREE_GAP })
    maxRight = Math.max(maxRight, cursor.x - TREE_GAP)
    bandMeta.push({ cat, baseY, height: maxDepth * LEVEL_GAP_Y + DIM.macro.height + 24 })
    runningY = baseY + (maxDepth + 1) * LEVEL_GAP_Y + BAND_GAP
  }
  // Ancho homogéneo: todas las bandas del largo de la más larga.
  const bandNodes: Node[] = bandMeta.map((m) => ({
    id: `band:${m.cat}`, type: 'journeyBand', position: { x: 0, y: m.baseY - 16 },
    data: { label: CATEGORY_META[m.cat].label, color: CATEGORY_META[m.cat].color, width: maxRight + 24, height: m.height },
    draggable: false, selectable: false, connectable: false, zIndex: 0,
  }))

  // ── Flechas de transferencia entre nodos visibles ────────────────────────
  const color = STATE_COLORS.transfiere
  const nodeIds = new Set(nodes.map((n) => n.id))
  edgeMap.forEach((e) => {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return
    const count = e.assets.size
    const cols = e.links.reduce((s, l) => s + (l.columns?.length || 0), 0)
    edges.push({
      id: `t:${e.from}=>${e.to}`, source: e.from, sourceHandle: 'tout', target: e.to, targetHandle: 'tin', type: 'default', animated: !!assetFilter,
      label: `${count} act · ${cols} col`, labelBgPadding: [4, 2], labelBgBorderRadius: 4,
      labelBgStyle: { fill: '#0b1220', fillOpacity: 0.9 }, labelStyle: { fill: '#cbd5e1', fontSize: 10, fontWeight: 600 },
      // interactionWidth ensancha el área clicable para poder pulsar la línea en
      // cualquier nivel (macro / proceso / subproceso), no solo la etiqueta.
      interactionWidth: 26, zIndex: 5,
      style: { stroke: color, strokeWidth: Math.min(2 + count, 8), opacity: assetFilter ? 1 : 0.8, cursor: 'pointer' },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      data: { links: e.links },
    })
  })
  // Flechas a nivel de columna (activo expandido): campo → subproceso destino.
  fieldEdges.forEach((fe, i) => {
    if (!nodeIds.has(fe.from) || !nodeIds.has(fe.to)) return
    edges.push({
      id: `tf:${fe.from}=>${fe.to}:${i}`, source: fe.from, sourceHandle: 'tout', target: fe.to, targetHandle: 'tin',
      type: 'default', animated: !!assetFilter, label: fe.label, labelBgPadding: [3, 1], labelBgBorderRadius: 3,
      labelBgStyle: { fill: '#0b1220', fillOpacity: 0.85 }, labelStyle: { fill: '#cbd5e1', fontSize: 8.5 },
      interactionWidth: 20, zIndex: 6,
      style: { stroke: fe.color, strokeWidth: 1.6, opacity: 0.85, strokeDasharray: '5 3' },
      markerEnd: { type: MarkerType.ArrowClosed, color: fe.color, width: 12, height: 12 },
    })
  })

  return { nodes: [...bandNodes, ...nodes], edges }
}
