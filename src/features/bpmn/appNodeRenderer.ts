import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer'
import { append as svgAppend, create as svgCreate, attr as svgAttr } from 'tiny-svg'
import { isApplicationBO } from '@/features/applications/placeApplicationNode'

// Renderer custom: dibuja los nodos de APLICACIÓN como una COMPUTADORA (monitor),
// para diferenciarlos del «Almacén de datos» (activos) y del «Objeto de datos»
// (documentos). El nodo real sigue siendo un DataObjectReference marcado con el
// prefijo del nombre (🖥), que persiste en el XML; aquí solo cambia su dibujo.

const HIGH_PRIORITY = 1500

interface RShape { type?: string; width?: number; height?: number; x?: number; y?: number; businessObject?: { name?: string; isApplication?: boolean } }

function isAppShape(el: unknown): el is RShape {
  const s = el as RShape
  return (s?.type === 'bpmn:DataStoreReference' || s?.type === 'bpmn:DataObjectReference') && isApplicationBO(s.businessObject)
}

class AppNodeRenderer extends BaseRenderer {
  constructor(eventBus: unknown) { super(eventBus, HIGH_PRIORITY) }

  canRender(element: unknown): boolean { return isAppShape(element) }

  drawShape(parent: unknown, element: unknown): unknown {
    const s = element as RShape
    const w = s.width || 46
    const h = s.height || 44
    const add = (tag: string, attrs: Record<string, string | number>) => {
      const el = svgCreate(tag); svgAttr(el, attrs); svgAppend(parent, el); return el
    }
    // Marco / carcasa
    add('rect', { x: 0, y: 0, width: w, height: h, rx: 6, ry: 6, fill: '#0b2233', stroke: '#38bdf8', 'stroke-width': 1.6 })
    // Pantalla del monitor
    const mw = w * 0.64, mh = h * 0.44, mx = (w - mw) / 2, my = 5
    add('rect', { x: mx, y: my, width: mw, height: mh, rx: 2, fill: '#0ea5e9', stroke: '#7dd3fc', 'stroke-width': 1 })
    add('rect', { x: mx + 2, y: my + 2, width: mw - 4, height: mh - 4, rx: 1, fill: '#082f49' })
    // Base / soporte del monitor
    add('rect', { x: w / 2 - 3, y: my + mh, width: 6, height: 5, fill: '#7dd3fc' })
    add('rect', { x: w / 2 - 10, y: my + mh + 5, width: 20, height: 3, rx: 1.5, fill: '#7dd3fc' })
    // Etiqueta «APP»
    const t = svgCreate('text')
    svgAttr(t, { x: w / 2, y: h - 4, 'text-anchor': 'middle', 'font-size': 7, 'font-weight': 700, fill: '#7dd3fc', 'font-family': 'sans-serif' })
    t.textContent = 'APP'
    svgAppend(parent, t)
    // Rect invisible para el área de interacción / path
    const hit = svgCreate('rect'); svgAttr(hit, { x: 0, y: 0, width: w, height: h, fill: 'none' }); svgAppend(parent, hit)
    return hit
  }

  getShapePath(shape: unknown): string {
    const s = shape as Required<Pick<RShape, 'x' | 'y' | 'width' | 'height'>>
    const { x, y, width, height } = s
    return `M${x},${y}h${width}v${height}h-${width}z`
  }
}
;(AppNodeRenderer as unknown as { $inject: string[] }).$inject = ['eventBus']

const appNodeRendererModule = {
  __init__: ['appNodeRenderer'],
  appNodeRenderer: ['type', AppNodeRenderer],
}
export default appNodeRendererModule
