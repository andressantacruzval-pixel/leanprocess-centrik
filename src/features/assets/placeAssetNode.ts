import type { BpmnModelerInstance, BpmnElement, BpmnElementRegistry, BpmnElementFactory } from '@/types/bpmn'

// Coloca un nodo «Almacén de datos» (DataStoreReference) en el flujograma, cerca
// de la actividad indicada, y devuelve su id (para anclar el activo). Todo va
// envuelto en try/catch: si el modeler no lo permite, devuelve null y el activo
// se ancla igual a la actividad. La API real de diagram-js expone
// modeling.createShape(shape, position, parent), que el tipo mínimo no declara.

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface Placeable extends BpmnElement { parent?: BpmnElement }

export function placeDataStoreNear(modeler: BpmnModelerInstance, activityName: string): string | null {
  try {
    const registry = modeler.get('elementRegistry') as BpmnElementRegistry
    const factory = modeler.get('elementFactory') as BpmnElementFactory
    // modeling.createShape(shape, position, target) — firma real de diagram-js.
    const modeling = modeler.get('modeling') as unknown as {
      createShape: (shape: BpmnElement, pos: { x: number; y: number }, parent: BpmnElement) => BpmnElement
    }

    // Actividad ancla: coincide por nombre; si no, cualquier tarea; si no, el proceso.
    const all = registry.filter(() => true) as Placeable[]
    const target = activityName
      ? all.find((el) => /Task$/.test(el.type) && norm(el.businessObject?.name || '') === norm(activityName))
      : undefined
    const anchor = target
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
    const pos = { x: Math.round(ax + aw / 2), y: Math.round(ay + ah + 90) }

    const shape = factory.createShape({ type: 'bpmn:DataStoreReference' })
    const created = modeling.createShape(shape, pos, parent)
    return created?.id ?? shape?.id ?? null
  } catch (err) {
    console.warn('[placeDataStoreNear] no se pudo crear el nodo', err)
    return null
  }
}
