import type { BpmnModelerInstance, BpmnElement, BpmnElementRegistry, BpmnElementFactory } from '@/types/bpmn'

// Coloca un nodo «Almacén de datos» (DataStoreReference) en el flujograma, cerca
// de la actividad indicada, y devuelve su id (para anclar el activo). Todo va
// envuelto en try/catch: si el modeler no lo permite, devuelve null y el activo
// se ancla igual a la actividad. La API real de diagram-js expone
// modeling.createShape(shape, position, parent), que el tipo mínimo no declara.

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Elimina un nodo del diagrama (y sus conexiones) al borrar el activo anclado.
export function removeNode(modeler: BpmnModelerInstance, elementId: string): boolean {
  try {
    const registry = modeler.get('elementRegistry') as BpmnElementRegistry
    const modeling = modeler.get('modeling') as unknown as {
      removeElements?: (els: BpmnElement[]) => void
      removeShape?: (el: BpmnElement) => void
    }
    const el = registry.get(elementId)
    if (!el) return false
    if (modeling.removeElements) modeling.removeElements([el])
    else if (modeling.removeShape) modeling.removeShape(el)
    return true
  } catch (err) {
    console.warn('[removeNode] no se pudo eliminar el nodo', err)
    return false
  }
}

// Renombra un nodo del diagrama (para sincronizar el nombre del activo con su
// nodo Almacén de datos). Devuelve true si cambió algo.
export function renameNode(modeler: BpmnModelerInstance, elementId: string, name: string): boolean {
  try {
    const registry = modeler.get('elementRegistry') as BpmnElementRegistry
    const modeling = modeler.get('modeling') as unknown as { updateProperties: (el: BpmnElement, p: Record<string, unknown>) => void }
    const el = registry.get(elementId)
    if (!el) return false
    if ((el.businessObject?.name ?? '') === name) return false
    modeling.updateProperties(el, { name })
    return true
  } catch { return false }
}

interface Placeable extends BpmnElement { parent?: BpmnElement }

export function placeDataStoreNear(modeler: BpmnModelerInstance, activityName: string, assetName?: string): string | null {
  try {
    const registry = modeler.get('elementRegistry') as BpmnElementRegistry
    const factory = modeler.get('elementFactory') as BpmnElementFactory
    // Firmas reales de diagram-js que el tipo mínimo no declara.
    const modeling = modeler.get('modeling') as unknown as {
      createShape: (shape: BpmnElement, pos: { x: number; y: number }, parent: BpmnElement) => BpmnElement
      updateProperties: (el: BpmnElement, props: Record<string, unknown>) => void
      connect: (a: BpmnElement, b: BpmnElement, attrs?: Record<string, unknown>) => BpmnElement
      updateWaypoints: (conn: BpmnElement, wps: { x: number; y: number }[]) => void
    }

    // Actividad ancla: coincide por nombre; si no, cualquier tarea; si no, el proceso.
    const all = registry.filter(() => true) as Placeable[]
    const anchor = (activityName
      ? all.find((el) => /Task$/.test(el.type) && norm(el.businessObject?.name || '') === norm(activityName))
      : undefined)
      || all.find((el) => /Task$/.test(el.type))
      || all.find((el) => el.type === 'bpmn:Participant')

    // Contenedor: el padre del ancla (lane/proceso) o el proceso raíz.
    const parent = (anchor?.parent)
      || all.find((el) => el.type === 'bpmn:Process')
      || all.find((el) => el.type === 'bpmn:Participant')
    if (!parent) return null

    const ax = anchor?.x ?? 200
    const ay = anchor?.y ?? 200
    const aw = anchor?.width ?? 100
    const ah = anchor?.height ?? 80
    const pos = { x: Math.round(ax + aw / 2), y: Math.round(ay + ah + 100) }

    const shape = factory.createShape({ type: 'bpmn:DataStoreReference' })
    const created = modeling.createShape(shape, pos, parent) || shape
    // Nombre del activo como título del nodo (bidireccional con el formulario).
    if (assetName) { try { modeling.updateProperties(created, { name: assetName }) } catch { /* no-op */ } }
    // Flecha del nodo (abajo) a la actividad: Association (Bizagi la dibuja) con
    // waypoints explícitos para que exporte con geometría.
    if (anchor && /Task$/.test(anchor.type)) {
      try {
        const conn = modeling.connect(created, anchor, { type: 'bpmn:Association', associationDirection: 'One' })
        if (conn) modeling.updateWaypoints(conn, [
          { x: (created.x ?? pos.x) + (created.width ?? 50) / 2, y: created.y ?? pos.y },
          { x: (anchor.x ?? ax) + (anchor.width ?? aw) / 2, y: (anchor.y ?? ay) + (anchor.height ?? ah) },
        ])
      } catch { /* no-op */ }
    }
    return created?.id ?? null
  } catch (err) {
    console.warn('[placeDataStoreNear] no se pudo crear el nodo', err)
    return null
  }
}
