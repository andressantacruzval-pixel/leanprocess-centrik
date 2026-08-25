import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import ReactFlow, {
  Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow, type Connection,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Search, X, Maximize2, Minimize2, Route } from 'lucide-react'
import { AssetLifecycleModal } from './AssetLifecycleModal'
import { useProcessStore } from '@/stores/processStore'
import { useAssetStore } from '@/stores/assetStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { toast } from '@/stores/toastStore'
import type { AssetColumn, InformationAsset } from '@/types/asset'
import type { Node, Edge } from 'reactflow'
import { buildJourney, STATE_COLORS, STATE_LABELS, type JourneyEdgeLink } from './journeyGraph'
import { JourneyNode } from './JourneyNode'
import { JourneyBand } from './JourneyBand'
import { JourneyLinkModal } from './JourneyLinkModal'
import { JourneyEdgeModal } from './JourneyEdgeModal'
import { FieldEditModal } from './FieldEditModal'
import { AssetFormModal } from '../components/AssetFormModal'

const nodeTypes = { journeyNode: JourneyNode, journeyBand: JourneyBand }

// Reencuadra el lienzo cuando cambia la estructura (expandir/colapsar niveles).
function FitOnDrill({ dep }: { dep: string }) {
  const rf = useReactFlow()
  useEffect(() => { const t = setTimeout(() => rf.fitView({ padding: 0.2, duration: 300 }), 60); return () => clearTimeout(t) }, [dep, rf])
  return null
}
const ALL_STATES = ['crea', 'usa', 'almacena', 'transforma', 'transfiere', 'elimina']
const CHIP_STATES = ['crea', 'transfiere', 'elimina'] // los que cambian el grafo

function flip(set: Set<string>, id: string): Set<string> {
  const n = new Set(set)
  if (n.has(id)) n.delete(id); else n.add(id)
  return n
}

export function DataJourneyGraph() {
  const companyId = useWorkspaceStore((s) => s.activeCompanyId)
  const allMacros = useProcessStore((s) => s.macroprocesses)
  const allProcesses = useProcessStore((s) => s.processes)
  const allAssets = useAssetStore((s) => s.assets)
  const allOps = useAssetStore((s) => s.operations)

  const macros = useMemo(() => allMacros.filter((m) => m.company_id === companyId), [allMacros, companyId])
  const processes = useMemo(() => allProcesses.filter((p) => p.company_id === companyId), [allProcesses, companyId])
  const assets = useMemo(() => allAssets.filter((a) => a.company_id === companyId), [allAssets, companyId])
  const operations = useMemo(() => allOps.filter((o) => o.company_id === companyId), [allOps, companyId])

  const [expandedMacros, setExpandedMacros] = useState<Set<string>>(new Set())
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set())
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set())
  const [assetFilter, setAssetFilter] = useState<Set<string>>(new Set())
  const [stateFilter, setStateFilter] = useState<Set<string>>(new Set(ALL_STATES))
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [pending, setPending] = useState<{ assetId: string; procId: string } | null>(null)
  const [editAsset, setEditAsset] = useState<InformationAsset | null>(null)
  const [edgeLinks, setEdgeLinks] = useState<JourneyEdgeLink[] | null>(null)
  const [lifecycleAsset, setLifecycleAsset] = useState<InformationAsset | null>(null)
  const [editField, setEditField] = useState<{ kind: 'asset'; assetId: string; idx: number; col: AssetColumn } | { kind: 'link'; opId: string; idx: number; col: AssetColumn } | null>(null)
  const addJourneyLink = useAssetStore((s) => s.addJourneyLink)
  const updateJourneyLink = useAssetStore((s) => s.updateJourneyLink)
  const updateAsset = useAssetStore((s) => s.updateAsset)

  // Clic en nodos: activo → ficha; recibido → ficha del activo origen; campo →
  // edición rápida de la columna (bidireccional con la ficha).
  const onNodeClick = useCallback((_e: MouseEvent, node: Node) => {
    const id = node.id
    if (id.includes('::f')) {
      const idx = Number(id.slice(id.indexOf('::f') + 3))
      if (id.startsWith('a:')) {
        const assetId = id.slice(2, id.indexOf('::f'))
        const a = assets.find((x) => x.id === assetId); const col = a?.columns?.[idx]
        if (a && col) setEditField({ kind: 'asset', assetId, idx, col })
      } else if (id.startsWith('r:')) {
        const opId = id.slice(2, id.indexOf('::f'))
        const op = operations.find((o) => o.id === opId); const col = op?.columns?.[idx]
        if (op && col) setEditField({ kind: 'link', opId, idx, col })
      }
      return
    }
    if (id.startsWith('a:')) { const a = assets.find((x) => x.id === id.slice(2)); if (a) setEditAsset(a) }
    else if (id.startsWith('r:')) {
      // Recibido: el tratamiento es POR SUBPROCESO → se edita en el enlace, no en
      // el activo origen. Abre el detalle del enlace (no la ficha compartida).
      const op = operations.find((o) => o.id === id.slice(2)); const a = op && assets.find((x) => x.id === op.asset_id)
      if (op && a) setEdgeLinks([{ opId: op.id, assetId: a.id, assetName: a.name, assetColumns: a.columns ?? [], columns: op.columns ?? [], justification: op.justification ?? '', destOperation: op.dest_operation, medium: op.medium, mediumDetail: op.medium_detail }])
    }
  }, [assets, operations])

  const saveField = (col: AssetColumn) => {
    if (!editField) return
    if (editField.kind === 'asset') {
      const a = assets.find((x) => x.id === editField.assetId); if (!a) return
      updateAsset(a.id, { columns: (a.columns ?? []).map((c, i) => (i === editField.idx ? col : c)) })
    } else {
      const op = operations.find((o) => o.id === editField.opId); if (!op) return
      const cols = (op.columns ?? []).map((c, i) => (i === editField.idx ? col : c))
      updateJourneyLink(op.id, cols, op.justification ?? '', op.dest_operation, op.medium, op.medium_detail)
    }
  }
  // Clic en una flecha de transferencia → detalle de activos y columnas.
  const onEdgeClick = useCallback((_e: MouseEvent, edge: Edge) => {
    const links = (edge.data as { links?: JourneyEdgeLink[] } | undefined)?.links
    if (links && links.length) setEdgeLinks(links)
  }, [])

  const onToggle = useCallback((nodeId: string) => {
    const raw = nodeId.slice(2)
    if (nodeId.startsWith('m:')) setExpandedMacros((prev) => flip(prev, raw))
    else if (nodeId.startsWith('p:')) setExpandedProcesses((prev) => flip(prev, raw))
    else setExpandedAssets((prev) => flip(prev, nodeId)) // a:/r: → expandir campos
  }, [])

  const built = useMemo(() => {
    const filter = assetFilter.size ? assetFilter : null
    const { nodes, edges } = buildJourney({ macros, processes, assets, operations, expandedMacros, expandedProcesses, expandedAssets, assetFilter: filter, stateFilter })
    return { nodes: nodes.map((n) => (n.type === 'journeyNode' ? { ...n, data: { ...n.data, onToggle, connecting } } : n)), edges }
  }, [macros, processes, assets, operations, expandedMacros, expandedProcesses, expandedAssets, assetFilter, stateFilter, onToggle, connecting])

  // Conexión activo → subproceso (Data Journey). Solo se permite ese sentido.
  const isValidConnection = useCallback((c: Connection) => !!c.source?.startsWith('a:') && !!c.target?.startsWith('p:'), [])
  const onConnect = useCallback((c: Connection) => {
    if (!c.source?.startsWith('a:') || !c.target?.startsWith('p:')) return
    setPending({ assetId: c.source.slice(2), procId: c.target.slice(2) })
  }, [])
  const pendingAsset = pending ? assets.find((a) => a.id === pending.assetId) : undefined
  const pendingProc = pending ? processes.find((p) => p.id === pending.procId) : undefined
  const confirmLink = (direction: 'to' | 'from', cols: AssetColumn[], justification: string) => {
    if (!pendingAsset || !pending) return
    addJourneyLink(pendingAsset.id, pendingAsset.process_id, direction, pending.procId, cols, justification)
    toast.success('Conexión registrada en el Data Journey.')
    setPending(null)
  }

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => { setNodes(built.nodes); setEdges(built.edges) }, [built, setNodes, setEdges])

  // Al seleccionar un nodo, se «encienden» sus relacionados (los unidos por una
  // flecha o por la jerarquía) y se atenúan los demás, para leer el viaje del dato.
  const onSelectionChange = useCallback((p: { nodes: Node[] }) => setSelectedId(p.nodes[0]?.id ?? null), [])
  const displayNodes = useMemo(() => {
    const active = selectedId && nodes.some((n) => n.id === selectedId)
    if (!active) return nodes
    const related = new Set<string>([selectedId!])
    for (const e of edges) {
      if (e.source === selectedId) related.add(e.target)
      if (e.target === selectedId) related.add(e.source)
    }
    return nodes.map((n) => (n.type !== 'journeyNode' ? n : { ...n, data: { ...n.data, dimmed: !related.has(n.id) } }))
  }, [nodes, edges, selectedId])
  const displayEdges = useMemo(() => {
    const active = selectedId && nodes.some((n) => n.id === selectedId)
    if (!active) return edges
    return edges.map((e) => {
      const on = e.source === selectedId || e.target === selectedId
      return { ...e, animated: on ? true : e.animated, style: { ...e.style, opacity: on ? 1 : 0.06 }, labelStyle: { ...(e.labelStyle as object), opacity: on ? 1 : 0.15 } }
    })
  }, [edges, nodes, selectedId])
  const drillKey = useMemo(() => `${[...expandedMacros].sort().join(',')}|${[...expandedProcesses].sort().join(',')}|${[...expandedAssets].sort().join(',')}`, [expandedMacros, expandedProcesses, expandedAssets])

  const expandAll = () => {
    setExpandedMacros(new Set(macros.map((m) => m.id)))
    setExpandedProcesses(new Set(processes.filter((p) => processes.some((c) => c.parent_process_id === p.id)).map((p) => p.id)))
  }
  const collapseAll = () => { setExpandedMacros(new Set()); setExpandedProcesses(new Set()); setExpandedAssets(new Set()) }

  const toggleState = (st: string) => setStateFilter((prev) => flip(prev, st))
  const toggleAsset = (id: string) => setAssetFilter((prev) => flip(prev, id))

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets.slice(0, 8)
    return assets.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 12)
  }, [assets, query])
  const selected = assets.filter((a) => assetFilter.has(a.id))

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-white/8 bg-[#0b1220]">
        {/* Buscar activo */}
        <div className="relative">
          <button onClick={() => setShowSearch((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 hover:bg-white/10">
            <Search size={13} /> Buscar activo
          </button>
          {showSearch && (
            <div className="absolute z-30 mt-1 w-72 rounded-xl border border-white/12 bg-[#0d1420] shadow-2xl p-2">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre del activo…"
                className="w-full mb-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {matches.length === 0 ? <p className="text-[11px] text-white/30 px-2 py-2">Sin activos.</p> : matches.map((a) => (
                  <button key={a.id} onClick={() => toggleAsset(a.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11.5px] ${assetFilter.has(a.id) ? 'bg-cyan-500/15 text-cyan-200' : 'text-white/70 hover:bg-white/5'}`}>
                    <span className="truncate flex-1">{a.name}</span>
                    {a.asset_type && <span className="text-[8.5px] px-1 py-0.5 rounded bg-white/8 text-white/40 shrink-0">{a.asset_type}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chips de activos seleccionados */}
        {selected.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[10.5px] text-cyan-200">
            {a.name}
            <button onClick={() => toggleAsset(a.id)} className="text-cyan-300/70 hover:text-white"><X size={11} /></button>
          </span>
        ))}
        {assetFilter.size > 0 && (
          <button onClick={() => setAssetFilter(new Set())} className="text-[10.5px] text-white/45 hover:text-white/80 underline">Ver todo</button>
        )}

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Estados */}
        {CHIP_STATES.map((st) => (
          <button key={st} onClick={() => toggleState(st)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10.5px] font-medium transition-colors ${stateFilter.has(st) ? 'border-white/20 text-white' : 'border-white/8 text-white/35'}`}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: stateFilter.has(st) ? STATE_COLORS[st] : 'transparent', border: `1px solid ${STATE_COLORS[st]}` }} />
            {STATE_LABELS[st]}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {selected.length === 1 && (
            <button onClick={() => setLifecycleAsset(selected[0])} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-[10.5px] text-cyan-200 hover:bg-cyan-500/20" title="Ver el ciclo de vida del dato por subproceso"><Route size={12} /> Ciclo de vida</button>
          )}
          <button onClick={expandAll} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10.5px] text-white/60 hover:bg-white/10"><Maximize2 size={12} /> Expandir</button>
          <button onClick={collapseAll} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10.5px] text-white/60 hover:bg-white/10"><Minimize2 size={12} /> Colapsar</button>
        </div>
      </div>

      {/* Leyenda de tratamientos de datos */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 border-b border-white/8 bg-[#0a1018]">
        <span className="text-[9px] uppercase tracking-wider text-white/35">Tratamiento del dato:</span>
        {['capta', 'crea', 'usa', 'almacena', 'transforma', 'transfiere', 'elimina'].map((st) => (
          <span key={st} className="inline-flex items-center gap-1 text-[10px] text-white/55">
            <span className="w-2 h-2 rounded-full" style={{ background: STATE_COLORS[st] }} /> {STATE_LABELS[st]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[10px] text-white/40"><span className="w-2 h-2 rounded-full bg-slate-500" /> No se envía</span>
      </div>

      {/* Lienzo */}
      <div className="flex-1 min-h-0 relative">
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10 pointer-events-none">
            <Route size={30} className="text-white/10 mb-3" />
            <p className="text-sm text-white/35">No hay flujos que mostrar</p>
            <p className="text-[11px] text-white/20 mt-1">Registra activos y sus transferencias («viene de / va a») para dibujar el viaje.</p>
          </div>
        )}
        <ReactFlow
          nodes={displayNodes} edges={displayEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onConnectStart={() => setConnecting(true)}
          onConnectEnd={() => setConnecting(false)}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onSelectionChange={onSelectionChange}
          isValidConnection={isValidConnection}
          fitView fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15} maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <FitOnDrill dep={drillKey} />
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#1e293b" />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap className="!hidden lg:!block !bg-[#0a0f1a] !border !border-white/10 !rounded-lg" maskColor="rgba(7,11,20,.75)" nodeColor="#334155" nodeStrokeColor="#475569" pannable zoomable />
        </ReactFlow>
      </div>

      {pending && pendingAsset && pendingProc && (
        <JourneyLinkModal
          assetName={pendingAsset.name}
          columns={pendingAsset.columns ?? []}
          targetName={pendingProc.name}
          onConfirm={confirmLink}
          onClose={() => setPending(null)}
        />
      )}

      {editAsset && (
        <AssetFormModal
          processId={editAsset.process_id ?? ''}
          bpmnElementId={editAsset.bpmn_element_id}
          asset={editAsset}
          onClose={() => setEditAsset(null)}
        />
      )}

      {editField && (
        <FieldEditModal column={editField.col} onSave={saveField} onClose={() => setEditField(null)} />
      )}

      {lifecycleAsset && (
        <AssetLifecycleModal asset={lifecycleAsset} onClose={() => setLifecycleAsset(null)} />
      )}

      {edgeLinks && (
        <JourneyEdgeModal
          links={edgeLinks}
          onSave={(opId, cols, justification, destOp, medium, mediumDetail) => updateJourneyLink(opId, cols, justification, destOp, medium, mediumDetail)}
          onOpenAsset={(assetId) => { const a = assets.find((x) => x.id === assetId); if (a) { setEdgeLinks(null); setEditAsset(a) } }}
          onClose={() => setEdgeLinks(null)}
        />
      )}
    </div>
  )
}
