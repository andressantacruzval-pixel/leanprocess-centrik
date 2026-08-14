import type { Node, Edge } from 'reactflow'

export type BpmnDiagram = {
  id: string
  process_id: string
  name: string
  diagram_json: {
    nodes: Node[]
    edges: Edge[]
  } | null
  diagram_xml?: string
  generated_by_ai: boolean
  ai_prompt?: string
  version: number
  created_at: string
  updated_at: string
}

export type BpmnNodeType =
  | 'startEvent'
  | 'endEvent'
  | 'task'
  | 'gateway'
  | 'subprocess'
  | 'intermediateCatchEvent'
  | 'intermediateThrowEvent'
  | 'parallelGateway'
  | 'exclusiveGateway'
  | 'inclusiveGateway'

// ─── Tipos mínimos de bpmn-js (no exportados oficialmente por la lib) ────
// Solo cubren los métodos/propiedades que usamos en BpmnModeler/BpmnPalette.

export interface BpmnElement {
  id: string
  type: string
  x?: number
  y?: number
  width?: number
  height?: number
  waypoints?: Array<{ x: number; y: number }>
  source?: BpmnElement
  target?: BpmnElement
  businessObject?: { name?: string; id?: string }
}

export interface BpmnEvent {
  element: BpmnElement
  shape?: BpmnElement
}

export interface BpmnEventBus {
  on(event: string | string[], cb: (e: BpmnEvent) => void): void
  on(event: string, priority: number, cb: (e: BpmnEvent) => void): void
  off(event: string, cb: unknown): void
}

export interface BpmnModeling {
  resizeShape(shape: BpmnElement, bounds: { x: number; y: number; width: number; height: number }): void
  moveShape(shape: BpmnElement, delta: { x: number; y: number }): void
  updateWaypoints(connection: BpmnElement, waypoints: Array<{ x: number; y: number }>): void
  addLane(participant: BpmnElement, location: 'top' | 'bottom'): BpmnElement
}

export interface BpmnElementFactory {
  createShape(options: { type: string } & Record<string, unknown>): BpmnElement
  createParticipantShape(): BpmnElement
}

export interface BpmnCreateService {
  start(event: MouseEvent | React.MouseEvent, shape: BpmnElement): void
}

export interface BpmnElementRegistry {
  filter(fn: (el: BpmnElement) => boolean): BpmnElement[]
  get(id: string): BpmnElement | undefined
}

export interface BpmnOverlayDef {
  position: { top?: number; left?: number; right?: number; bottom?: number }
  html: string
}

export interface BpmnOverlays {
  add(elementId: string, type: string, def: BpmnOverlayDef): string
  remove(filter: { element: string; type: string }): void
}

export interface BpmnCanvas {
  zoom(level: 'fit-viewport' | number): void
}

export interface BpmnCommandStack {
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

export type BpmnModuleName =
  | 'eventBus'
  | 'modeling'
  | 'elementRegistry'
  | 'overlays'
  | 'canvas'
  | 'commandStack'

export interface BpmnModelerInstance {
  get(name: 'eventBus'): BpmnEventBus
  get(name: 'modeling'): BpmnModeling
  get(name: 'elementRegistry'): BpmnElementRegistry
  get(name: 'overlays'): BpmnOverlays
  get(name: 'canvas'): BpmnCanvas
  get(name: 'commandStack'): BpmnCommandStack
  get(name: 'elementFactory'): BpmnElementFactory
  get(name: 'create'): BpmnCreateService
  get(name: string): unknown
  saveSVG?(): Promise<{ svg: string }>
  saveXML?(opts?: { format?: boolean }): Promise<{ xml?: string }>
}
