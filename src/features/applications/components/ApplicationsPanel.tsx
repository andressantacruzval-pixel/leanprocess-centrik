import { useEffect, useState } from 'react'
import { MonitorSmartphone, Pencil, Plus } from 'lucide-react'
import type { BpmnModelerInstance, BpmnEventBus, BpmnElement, BpmnEvent } from '@/types/bpmn'
import { useApplicationStore } from '@/stores/applicationStore'
import { techRisk, DEPLOYMENT_OPTIONS, type Application } from '@/types/application'
import { isApplicationBO, stripAppPrefix } from '../placeApplicationNode'
import { AppFormModal } from './AppFormModal'

// Panel flotante de la APLICACIÓN. Aparece al seleccionar un nodo tipo computadora
// (marca isApplication) en el BPMN: muestra la ficha de la app anclada a ese nodo
// y abre su formulario. Integración bidireccional con el diagrama: renombrar el
// nodo actualiza el nombre de la app, y borrar el nodo quita su uso del panel.

const DATA_NODE_TYPES = new Set(['bpmn:DataStoreReference', 'bpmn:DataObjectReference'])
const deployLabel = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? ''

interface Props { modeler: BpmnModelerInstance | null; processId: string; readOnly?: boolean }
interface SelNode { id: string; label: string }

export function ApplicationsPanel({ modeler, processId, readOnly }: Props) {
  const applications = useApplicationStore((s) => s.applications)
  const usages = useApplicationStore((s) => s.usages)
  const addApplication = useApplicationStore((s) => s.addApplication)
  const addUsage = useApplicationStore((s) => s.addUsage)

  const [node, setNode] = useState<SelNode | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Selección de un nodo de aplicación → mostrar su ficha.
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const onSel = (e: BpmnEvent) => {
      const sel = ((e as unknown as { newSelection?: BpmnElement[] }).newSelection ?? [])
      const el = sel.length === 1 ? sel[0] : null
      if (el && DATA_NODE_TYPES.has(el.type) && isApplicationBO(el.businessObject)) {
        setNode({ id: el.id, label: stripAppPrefix(el.businessObject?.name) || 'Aplicación' })
      } else setNode(null)
    }
    bus.on('selection.changed', onSel)
    return () => bus.off('selection.changed', onSel)
  }, [modeler])

  // Renombrar el nodo → actualiza el nombre de la app (bidireccional).
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const onChanged = (e: BpmnEvent) => {
      const el = e.element
      if (!el || !DATA_NODE_TYPES.has(el.type) || !isApplicationBO(el.businessObject)) return
      const name = stripAppPrefix(el.businessObject?.name).trim()
      if (!name) return
      const st = useApplicationStore.getState()
      const u = st.usages.find((x) => x.bpmn_element_id === el.id)
      const app = u && st.applications.find((a) => a.id === u.application_id)
      if (app && app.name !== name) st.updateApplication(app.id, { name })
    }
    bus.on('element.changed', onChanged)
    return () => bus.off('element.changed', onChanged)
  }, [modeler])

  // Borrar el nodo → quitar su uso del panel (la app se conserva en el catálogo).
  // Solo si NO quedan otros nodos de la misma app se va del proceso; si hay otro
  // nodo, la app sigue presente. Se escucha el comando (no la reconstrucción).
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const onDelete = (e: BpmnEvent) => {
      const id = (e as unknown as { context?: { shape?: { id?: string } } }).context?.shape?.id
      if (!id) return
      const st = useApplicationStore.getState()
      const u = st.usages.find((x) => x.bpmn_element_id === id)
      if (u) st.deleteUsage(u.id)
    }
    bus.on('commandStack.shape.delete.postExecuted', onDelete)
    return () => bus.off('commandStack.shape.delete.postExecuted', onDelete)
  }, [modeler])

  if (!modeler || !node) return null

  const usage = usages.find((u) => u.bpmn_element_id === node.id && u.process_id === processId)
  const app: Application | undefined = usage ? applications.find((a) => a.id === usage.application_id) : undefined
  const risk = app ? techRisk(app) : null

  const registerAndEdit = () => {
    const created = addApplication({ name: node.label, status: 'en_evaluacion' })
    if (created) { addUsage(created.id, processId, node.id, ''); setShowForm(true) }
  }

  return (
    <>
      <div className="absolute bottom-3 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-sky-500/25 bg-[#0d1420]/95 backdrop-blur-sm shadow-xl shadow-black/40">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
          <MonitorSmartphone size={14} className="text-sky-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate">App</p>
            <p className="text-[10px] text-white/40 truncate">{app?.name || node.label}</p>
          </div>
          {!readOnly && app && (
            <button onClick={() => setShowForm(true)} className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10.5px] font-medium hover:bg-sky-500/25"><Pencil size={11} /> Editar</button>
          )}
        </div>

        <div className="px-3 py-2.5">
          {!app ? (
            <div className="text-center py-2">
              <p className="text-[11px] text-white/40 mb-2">Este nodo aún no está registrado como aplicación.</p>
              {!readOnly && <button onClick={registerAndEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-medium hover:bg-sky-500/25"><Plus size={12} /> Registrar aplicación</button>}
            </div>
          ) : (
            <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
              <p className="text-[12.5px] font-medium text-white truncate">{app.name}</p>
              {app.description && <p className="text-[10.5px] text-white/45 mt-0.5 line-clamp-2">{app.description}</p>}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {app.category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{app.category}</span>}
                {app.ownership && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{app.ownership === 'propia' ? 'Propia' : app.ownership === 'terceros' ? 'Terceros' : 'Mixta'}</span>}
                {app.deployment && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/45">{deployLabel(app.deployment)}</span>}
                {app.has_api && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">API</span>}
                {risk && <span className="text-[9px] px-1.5 py-0.5 rounded text-white" style={{ background: risk.hex }}>Riesgo {risk.label}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {showForm && app && (
        <AppFormModal processId={processId} application={app} onClose={() => setShowForm(false)} />
      )}
    </>
  )
}
