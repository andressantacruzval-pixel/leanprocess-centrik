import { useEffect, useState } from 'react'
import { Database, Plus, Pencil, Trash2, ShieldCheck, Link2, Unlink } from 'lucide-react'
import type { BpmnModelerInstance, BpmnEventBus, BpmnElement, BpmnEvent } from '@/types/bpmn'
import { useAssetStore } from '@/stores/assetStore'
import { getRiskLevel } from '@/types/risk'
import { type InformationAsset } from '@/types/asset'
import { removeNode, renameNode } from '../placeAssetNode'
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
  const linkAssetToNode = useAssetStore((s) => s.linkAssetToNode)
  const unlinkAsset = useAssetStore((s) => s.unlinkAsset)

  const [node, setNode] = useState<SelNode | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InformationAsset | null>(null)
  const [showLink, setShowLink] = useState(false)

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

  // Desacople activo ↔ nodo: si el usuario borra el nodo en el diagrama, el activo
  // NO se borra; solo se desvincula (queda en el catálogo para re-vincularlo). El
  // borrado del activo desde el panel elimina el activo ANTES que el nodo, así que
  // aquí ya no hay activo que desvincular y no se dispara escritura huérfana.
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const onRemoved = (e: BpmnEvent) => {
      const el = e.element
      if (!el || !DATA_NODE_TYPES.has(el.type)) return
      const asset = useAssetStore.getState().assets.find((a) => a.bpmn_element_id === el.id && a.process_id === processId)
      if (asset) unlinkAsset(asset.id)
    }
    bus.on('shape.removed', onRemoved)
    return () => { bus.off('shape.removed', onRemoved) }
  }, [modeler, processId, unlinkAsset])

  if (!modeler || !node) return null

  const nodeAssets = assets.filter((a) => a.bpmn_element_id === node.id && a.process_id === processId)
  // Activos del proceso sin nodo (catálogo) que se pueden vincular a este nodo.
  const linkable = assets.filter((a) => a.process_id === processId && !a.bpmn_element_id)

  const handleLink = (a: InformationAsset) => {
    linkAssetToNode(a.id, node.id)
    // El nombre del nodo sigue al del activo (bidireccional con el formulario).
    if (a.name) renameNode(modeler, node.id, a.name)
    setShowLink(false)
  }

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
                      <button onClick={() => { if (confirm(`¿Desvincular «${a.name}» de este nodo? El activo se conserva en el catálogo.`)) { unlinkAsset(a.id) } }} title="Desvincular del nodo (conserva el activo)" className="p-1.5 rounded text-white/30 hover:text-amber-400 hover:bg-amber-500/10"><Unlink size={12} /></button>
                      <button onClick={() => { if (confirm(`¿Eliminar el activo «${a.name}»? Se quita del catálogo y del diagrama.`)) { deleteAsset(a.id); if (modeler && a.bpmn_element_id) removeNode(modeler, a.bpmn_element_id) } }} title="Eliminar activo" className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {!readOnly && linkable.length > 0 && (
            <div className="pt-1">
              {!showLink ? (
                <button
                  onClick={() => setShowLink(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.03] text-white/50 border border-dashed border-white/10 text-[10.5px] font-medium hover:text-cyan-300 hover:border-cyan-500/30"
                >
                  <Link2 size={11} /> Vincular activo existente
                </button>
              ) : (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-2">
                  <p className="text-[10px] text-white/45 mb-1.5 px-0.5">Elige un activo del catálogo para anclarlo a este nodo:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {linkable.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => handleLink(a)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-[11px] text-white/70 hover:bg-white/5"
                        title="Vincular a este nodo"
                      >
                        <Link2 size={10} className="text-cyan-300 shrink-0" />
                        <span className="truncate flex-1">{a.name}</span>
                        {a.asset_type && <span className="text-[8.5px] px-1 py-0.5 rounded bg-white/5 text-white/40 shrink-0">{a.asset_type}</span>}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowLink(false)} className="mt-1.5 text-[10px] text-white/30 hover:text-white/50 px-0.5">Cancelar</button>
                </div>
              )}
            </div>
          )}
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
