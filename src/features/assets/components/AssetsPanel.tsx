import { useEffect, useState } from 'react'
import { Database, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import type { BpmnModelerInstance, BpmnEventBus, BpmnElement, BpmnEvent } from '@/types/bpmn'
import { useAssetStore } from '@/stores/assetStore'
import { getRiskLevel } from '@/types/risk'
import { type InformationAsset } from '@/types/asset'
import { removeNode } from '../placeAssetNode'
import { AssetFormModal } from './AssetFormModal'

// Panel flotante de Activos de Información. Aparece al seleccionar un nodo de
// «Almacén de datos» u «Objeto de datos» en el BPMN: lista los activos anclados a
// ese nodo y permite agregar/editar/eliminar. Los activos también quedan ligados
// al proceso para el inventario y (más adelante) el Data Journey.

const DATA_NODE_TYPES = new Set([
  'bpmn:DataStoreReference', 'bpmn:DataStore', 'bpmn:DataObjectReference', 'bpmn:DataObject',
])

interface Props { modeler: BpmnModelerInstance | null; processId: string; readOnly?: boolean }

interface SelNode { id: string; label: string }

export function AssetsPanel({ modeler, processId, readOnly }: Props) {
  const assets = useAssetStore((s) => s.assets)
  const getOperation = useAssetStore((s) => s.getOperation)
  const deleteAsset = useAssetStore((s) => s.deleteAsset)
  const updateAsset = useAssetStore((s) => s.updateAsset)

  const [node, setNode] = useState<SelNode | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InformationAsset | null>(null)

  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const onSel = (e: BpmnEvent) => {
      const newSelection = (e as unknown as { newSelection?: BpmnElement[] }).newSelection
      const sel = newSelection && newSelection.length === 1 ? newSelection[0] : null
      if (sel && DATA_NODE_TYPES.has(sel.type)) {
        setNode({ id: sel.id, label: sel.businessObject?.name || 'Almacén de datos' })
      } else {
        setNode(null)
      }
    }
    bus.on('selection.changed', onSel)
    return () => { bus.off('selection.changed', onSel) }
  }, [modeler])

  // Sincronización nodo → activo: si el usuario renombra el nodo Almacén de datos
  // en el diagrama, se actualiza el nombre del activo anclado (bidireccional con
  // el formulario, que hace el sentido inverso).
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const onChanged = (e: BpmnEvent) => {
      const el = e.element
      if (!el || !DATA_NODE_TYPES.has(el.type)) return
      const name = (el.businessObject?.name || '').trim()
      if (!name) return
      const asset = useAssetStore.getState().assets.find((a) => a.bpmn_element_id === el.id && a.process_id === processId)
      if (asset && asset.name !== name) updateAsset(asset.id, { name })
    }
    bus.on('element.changed', onChanged)
    return () => { bus.off('element.changed', onChanged) }
  }, [modeler, processId, updateAsset])

  if (!modeler || !node) return null

  const nodeAssets = assets.filter((a) => a.bpmn_element_id === node.id && a.process_id === processId)

  return (
    <>
      <div className="absolute bottom-3 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-indigo-500/25 bg-[#0d1420]/95 backdrop-blur-sm shadow-xl shadow-black/40">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
          <Database size={14} className="text-indigo-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate">Activos de información</p>
            <p className="text-[10px] text-white/40 truncate">{node.label}</p>
          </div>
          {!readOnly && (
            <button
              onClick={() => { setEditing(null); setShowForm(true) }}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10.5px] font-medium hover:bg-indigo-500/25"
            >
              <Plus size={11} /> Activo
            </button>
          )}
        </div>

        <div className="px-3 py-2.5 space-y-2 max-h-[42vh] overflow-y-auto">
          {nodeAssets.length === 0 ? (
            <p className="text-[11px] text-white/35 py-3 text-center">Sin activos en este nodo. Pulsa «＋ Activo» para registrar uno.</p>
          ) : nodeAssets.map((a) => {
            const crit = a.criticality || 0
            const lvl = crit ? getRiskLevel(crit, crit) : null
            const op = getOperation(a.id, processId)?.operation
            return (
              <div key={a.id} className="group rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-white truncate flex items-center gap-1.5"><ShieldCheck size={11} className="text-indigo-300 shrink-0" />{a.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {a.asset_type && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{a.asset_type}</span>}
                      {op && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">{op}</span>}
                      {a.label && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{a.label}</span>}
                      {lvl && <span className={`text-[9px] px-1.5 py-0.5 rounded text-white ${lvl.color}`} title="Criticidad C·I·D">C·I·D {crit}</span>}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button onClick={() => { setEditing(a); setShowForm(true) }} title="Editar" className="p-1.5 rounded text-white/30 hover:text-cyan-400 hover:bg-white/5"><Pencil size={12} /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar el activo «${a.name}»?`)) { if (modeler && a.bpmn_element_id) removeNode(modeler, a.bpmn_element_id); deleteAsset(a.id) } }} title="Eliminar" className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showForm && (
        <AssetFormModal
          processId={processId}
          bpmnElementId={node.id}
          asset={editing}
          modeler={modeler}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </>
  )
}
