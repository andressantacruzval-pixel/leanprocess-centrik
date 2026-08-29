import { useEffect, useMemo, useState, useId } from 'react'
import { UserCog, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react'
import type { BpmnModelerInstance, BpmnModeling, BpmnElementRegistry, BpmnEventBus, BpmnElement } from '@/types/bpmn'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { normCargo, CARGO_CATALOG } from '../cargoData'

// Panel flotante "Cargos del diagrama": lista los lanes del BPMN y deja
// reconciliar cada uno con el catálogo de cargos mediante un campo con
// autocompletado (buscador nativo). Escribir un cargo nuevo lo permite; si no
// está en el catálogo, ofrece agregarlo en un clic. Renombra el lane con
// modeling.updateProperties, que dispara el auto-guardado del XML.

interface Lane { id: string; name: string }

interface Props { modeler: BpmnModelerInstance | null; readOnly?: boolean }

function readLanes(modeler: BpmnModelerInstance): Lane[] {
  const registry = modeler.get('elementRegistry') as BpmnElementRegistry
  return registry
    .filter((el: BpmnElement) => el.type === 'bpmn:Lane')
    .map((el) => ({ id: el.id, name: el.businessObject?.name ?? '' }))
}

export function CargoLanesPanel({ modeler, readOnly }: Props) {
  const catalogItems = useCatalogStore((s) => s.catalogItems)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const [lanes, setLanes] = useState<Lane[]>([])
  const [open, setOpen] = useState(true)
  const listId = useId()

  const cargos = useMemo(
    () => catalogItems.filter((c) => c.catalog_type === CARGO_CATALOG && c.is_active).map((c) => c.value).sort((a, b) => a.localeCompare(b, 'es')),
    [catalogItems]
  )
  const catalogKeys = useMemo(() => new Set(cargos.map(normCargo)), [cargos])

  useEffect(() => {
    if (!modeler) return
    const refresh = () => setLanes(readLanes(modeler))
    refresh()
    const bus = modeler.get('eventBus') as BpmnEventBus
    const events = ['elements.changed', 'commandStack.changed', 'import.done']
    events.forEach((e) => bus.on(e, refresh))
    return () => { events.forEach((e) => bus.off(e, refresh)) }
  }, [modeler])

  if (!modeler || !lanes.length) return null

  const rename = (laneId: string, name: string) => {
    const registry = modeler.get('elementRegistry') as BpmnElementRegistry
    const modeling = modeler.get('modeling') as BpmnModeling
    const el = registry.get(laneId)
    if (el && (el.businessObject?.name ?? '') !== name) modeling.updateProperties(el, { name })
  }

  const sinCatalogar = lanes.filter((l) => l.name.trim() && !catalogKeys.has(normCargo(l.name))).length

  return (
    <div className="absolute bottom-3 left-3 z-20 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-gray-200 bg-white shadow-xl">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <UserCog size={14} className="text-primary-700 shrink-0" />
        <span className="text-[12px] font-semibold text-gray-900 flex-1">Cargos del diagrama</span>
        {sinCatalogar > 0 && <span className="inline-flex items-center gap-1 text-[9px] text-amber-700"><AlertTriangle size={10} /> {sinCatalogar}</span>}
        {open ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-[40vh] overflow-y-auto">
          <datalist id={listId}>{cargos.map((c) => <option key={c} value={c} />)}</datalist>
          {lanes.map((l) => {
            const enCatalogo = !!l.name.trim() && catalogKeys.has(normCargo(l.name))
            return (
              <div key={l.id}>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${!l.name.trim() ? 'bg-gray-200' : enCatalogo ? 'bg-emerald-500' : 'bg-amber-500'}`} title={enCatalogo ? 'En catálogo' : 'Cargo no catalogado'} />
                  <input
                    key={l.id + '::' + l.name}
                    list={listId}
                    defaultValue={l.name}
                    disabled={readOnly}
                    placeholder="Cargo / rol…"
                    onBlur={(e) => rename(l.id, e.target.value.trim())}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>
                {!readOnly && !!l.name.trim() && !enCatalogo && (
                  <button onClick={() => addCatalogItem(CARGO_CATALOG, l.name.trim())} className="mt-1 ml-3 inline-flex items-center gap-1 text-[10px] text-amber-700 hover:text-amber-700">
                    <Plus size={10} /> Agregar «{l.name.trim()}» al catálogo
                  </button>
                )}
              </div>
            )
          })}
          <p className="text-[10px] text-gray-400 pt-1">Escribe para buscar un cargo del catálogo o crear uno nuevo. El punto ámbar marca cargos fuera del catálogo.</p>
        </div>
      )}
    </div>
  )
}
