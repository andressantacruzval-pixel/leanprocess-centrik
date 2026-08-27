// Declaraciones mínimas para escribir un renderer custom de bpmn-js/diagram-js.
declare module 'diagram-js/lib/draw/BaseRenderer' {
  export default class BaseRenderer {
    constructor(eventBus: unknown, priority?: number)
    canRender(element: unknown): boolean
    drawShape(parent: unknown, element: unknown): unknown
    drawConnection(parent: unknown, element: unknown): unknown
    getShapePath(shape: unknown): string
    getConnectionPath(connection: unknown): string
  }
}

declare module 'tiny-svg' {
  export function create(name: string): SVGElement
  export function append(parent: unknown, child: unknown): void
  export function attr(node: unknown, attrs: Record<string, string | number>): unknown
}
