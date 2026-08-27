import type { BpmnModelerInstance, BpmnElement, BpmnElementRegistry, BpmnElementFactory } from '@/types/bpmn'

// Coloca un nodo «Aplicación / Equipo» en el flujograma, cerca de la actividad
// donde se usa, y lo conecta a ella. Reutiliza el mecanismo del «Almacén de
// datos» (DataObjectReference) pero con un prefijo de icono para distinguirlo
// visualmente de los activos de información. removeNode/renameNode se reutilizan
// desde placeAssetNode (son genéricos).

// Prefijo que marca un nodo como Aplicación (no confundir con activo de datos).
export const APP_NODE_PREFIX = '🖥 '

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// ¿El nodo es de aplicación? (por el prefijo del nombre)
export function isAppNode(name: string | undefined | null): boolean {
  return (name ?? '').startsWith(APP_NODE_PREFIX)
}
export function appLabel(name: string): string {
  return `${APP_NODE_PREFIX}${name}`.trim()
}
export function stripAppPrefix(name: string | undefined | null): string {
  return (name ?? '').replace(APP_NODE_PREFIX, '').trim()
}

interface Placeable extends BpmnElement { parent?: BpmnElement }

export function placeApplicationNode(modeler: BpmnModelerInstance, activityName: string, appName?: string): string | null {
  try {
    const registry = modeler.get('elementRegistry') as BpmnElementRegistry
    const factory = modeler.get('elementFactory') as BpmnElementFactory
    const modeling = modeler.get('modeling') as unknown as {
      createShape: (shape: BpmnElement, pos: { x: number; y: number }, parent: BpmnElement) => BpmnElement
      updateProperties: (el: BpmnElement, props: Record<string, unknown>) => void
      connect: (a: BpmnElement, b: BpmnElement) => BpmnElement
    }

    const all = registry.filter(() => true) as Placeable[]
    const anchor = (activityName
      ? all.find((el) => /Task$/.test(el.type) && norm(el.businessObject?.name || '') === norm(activityName))
      : undefined)
      || all.find((el) => /Task$/.test(el.type))
      || all.find((el) => el.type === 'bpmn:Participant')

    const parent = (anchor?.parent)
      || all.find((el) => el.type === 'bpmn:Process')
      || all.find((el) => el.type === 'bpmn:Participant')
    if (!parent) return null

    const ax = anchor?.x ?? 200
    const ay = anchor?.y ?? 200
    const aw = anchor?.width ?? 100
    // Se coloca ARRIBA de la actividad (los activos van abajo) para no encimarse.
    const pos = { x: Math.round(ax + aw / 2), y: Math.round(ay - 110) }

    const shape = factory.createShape({ type: 'bpmn:DataObjectReference' })
    const created = modeling.createShape(shape, pos, parent) || shape
    if (appName) { try { modeling.updateProperties(created, { name: appLabel(appName) }) } catch { /* no-op */ } }
    if (anchor && /Task$/.test(anchor.type)) { try { modeling.connect(created, anchor) } catch { /* no-op */ } }
    return created?.id ?? null
  } catch (err) {
    console.warn('[placeApplicationNode] no se pudo crear el nodo', err)
    return null
  }
}
