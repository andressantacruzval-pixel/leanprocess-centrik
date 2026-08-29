import { useEffect, useRef, useCallback, useState } from 'react'
import BpmnJS from 'bpmn-js/lib/Modeler'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'
import './bpmn-centrik-theme.css'
import type {
  BpmnElement,
  BpmnEvent,
  BpmnEventBus,
  BpmnModeling,
  BpmnElementRegistry,
  BpmnOverlays,
  BpmnCanvas,
  BpmnModelerInstance,
} from '@/types/bpmn'
import { injectMissingBpmnEdges } from '@/lib/bpmnLayoutFix'
import appNodeRendererModule from '../appNodeRenderer'
import leanModdle from '../leanModdle'

// Elimina waypoints con coordenadas NaN del XML antes de importar.
function sanitizeBpmnXml(xml: string): string {
  if (!xml.includes('NaN')) return xml
  return xml.replace(/<(?:\w+:)?waypoint\b[^>]*\/>/g, (match) =>
    match.includes('NaN') ? '' : match
  )
}

// ── Bizagi-compatible blank BPMN (collaboration-based with A4 landscape pool) ──
const RECOVERY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn"
  exporter="Lean Process"
  exporterVersion="1.0">
  <bpmn2:collaboration id="Collaboration_1">
    <bpmn2:participant id="Participant_1" name="Proceso" processRef="Process_1" />
  </bpmn2:collaboration>
  <bpmn2:process id="Process_1" isExecutable="false">
    <bpmn2:laneSet id="LaneSet_1">
      <bpmn2:lane id="Lane_1" name="Rol 1">
        <bpmn2:flowNodeRef>StartEvent_1</bpmn2:flowNodeRef>
      </bpmn2:lane>
    </bpmn2:laneSet>
    <bpmn2:startEvent id="StartEvent_1" name="Inicio" />
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="1122" height="250" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_1_di" bpmnElement="Lane_1" isHorizontal="true">
        <dc:Bounds x="30" y="0" width="1092" height="250" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="82" y="107" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="85" y="150" width="30" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`

interface BpmnModelerProps {
  xml: string
  onXmlChange?: (xml: string) => void
  onModelerReady?: (modeler: BpmnModelerInstance) => void
  readOnly?: boolean
  hidePalette?: boolean
  className?: string
}

export function BpmnModeler({ xml, onXmlChange, onModelerReady, readOnly, hidePalette, className }: BpmnModelerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const modelerRef = useRef<InstanceType<typeof BpmnJS> | null>(null)
  const xmlRef = useRef(xml)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const internalChangeRef = useRef(false)
  const handleChanged = useCallback(async () => {
    if (!modelerRef.current || !onXmlChange) return
    internalChangeRef.current = true
    try {
      const result = await modelerRef.current.saveXML({ format: true })
      if (result.xml) {
        xmlRef.current = result.xml
        onXmlChange(result.xml)
      }
    } catch {
      // Ignore save errors during editing
    }
    internalChangeRef.current = false
  }, [onXmlChange])

  // Try to import XML with fallback to recovery BPMN. Acepta un
  // `isCurrent` para poder abortar sin tocar estado cuando el modeler
  // de esta invocacion ya fue destruido (StrictMode double-mount).
  const importWithFallback = useCallback(
    async (
      modeler: InstanceType<typeof BpmnJS>,
      xmlToImport: string,
      isCurrent: () => boolean = () => true
    ) => {
      const safeZoom = () => {
        if (!isCurrent()) return false
        try {
          const canvas = modeler.get('canvas') as BpmnCanvas
          canvas.zoom('fit-viewport')
          return true
        } catch {
          return false
        }
      }

      try {
        await modeler.importXML(injectMissingBpmnEdges(sanitizeBpmnXml(xmlToImport)))
        if (!isCurrent()) return false
        safeZoom()
        setError(null)
        return true
      } catch (err) {
        // Modeler destruido mid-import (StrictMode) → silenciosamente
        // abortar sin tocar el estado de React.
        if (!isCurrent()) return false

        const errMsg = err instanceof Error ? err.message : String(err)
        console.warn('[BpmnModeler] Failed to import XML, trying recovery:', errMsg)
        if (xmlToImport !== RECOVERY_BPMN) {
          try {
            await modeler.importXML(RECOVERY_BPMN)
            if (!isCurrent()) return false
            safeZoom()
            xmlRef.current = RECOVERY_BPMN
            onXmlChange?.(RECOVERY_BPMN)
            setError(null)
            return true
          } catch {
            if (!isCurrent()) return false
          }
        }
        setError(errMsg || 'Error al cargar el diagrama')
        return false
      }
    },
    [onXmlChange]
  )

  // ── Conectores ortogonales (90 grados) preservando puntos de anclaje ──
  // Hace que todas las flechas sean ortogonales (sin diagonales) pero
  // respeta el punto de anclaje donde el usuario conectó (borde izquierdo,
  // inferior, etc.). Solo normaliza los waypoints intermedios, nunca mueve
  // el inicio ni el fin de la conexión.
  const enforceOrthogonalConnectors = useCallback((modeler: InstanceType<typeof BpmnJS>) => {
    try {
      const eventBus = modeler.get('eventBus') as BpmnEventBus
      const modeling = modeler.get('modeling') as BpmnModeling
      const elementRegistry = modeler.get('elementRegistry') as BpmnElementRegistry
      let reentering = false

      const isOrthogonal = (waypoints: { x: number; y: number }[]): boolean => {
        for (let i = 1; i < waypoints.length; i++) {
          const a = waypoints[i - 1]
          const b = waypoints[i]
          if (Math.abs(b.x - a.x) > 1 && Math.abs(b.y - a.y) > 1) return false
        }
        return true
      }

      // Genera un camino ortogonal entre start y end preservando ambos puntos.
      // Usa L-shape (un codo a 90°) eligiendo la dirección según cuál delta es mayor.
      const computeOrthogonalPath = (
        start: { x: number; y: number },
        end: { x: number; y: number }
      ): { x: number; y: number }[] => {
        const dx = Math.abs(end.x - start.x)
        const dy = Math.abs(end.y - start.y)

        // Ya alineados: sin codo necesario
        if (dy < 1) return [start, end]
        if (dx < 1) return [start, end]

        // L-shape: horizontal primero si dx domina, vertical primero si dy domina
        if (dx >= dy) {
          return [start, { x: end.x, y: start.y }, end]
        } else {
          return [start, { x: start.x, y: end.y }, end]
        }
      }

      const normalizeAllConnections = () => {
        if (reentering) return
        reentering = true
        try {
          const conns = elementRegistry.filter(
            (e: BpmnElement) => !!(e.waypoints && e.source && e.target)
          )
          conns.forEach((conn: BpmnElement) => {
            if (conn.waypoints && !isOrthogonal(conn.waypoints)) {
              const wps = conn.waypoints
              const start = wps[0]
              const end = wps[wps.length - 1]
              const wp = computeOrthogonalPath(start, end)
              try {
                modeling.updateWaypoints(conn, wp)
              } catch {
                // Ignore: shape may be in transient state
              }
            }
          })
        } finally {
          reentering = false
        }
      }

      // Normaliza al crear conexiones nuevas, mover formas y mover bendpoints.
      // computeOrthogonalPath preserva los anclajes elegidos por el usuario.
      eventBus.on(
        [
          'commandStack.connection.create.postExecuted',
          'commandStack.connection.reconnect.postExecuted',
          'commandStack.shape.move.postExecuted',
          'commandStack.elements.move.postExecuted',
          'commandStack.bendpoint.move.postExecuted',
          'commandStack.connection.updateWaypoints.postExecuted',
        ],
        normalizeAllConnections
      )

      return normalizeAllConnections
    } catch (err) {
      console.warn('[BpmnModeler] Could not install orthogonal enforcer:', err)
    }
  }, [])

  // A4 landscape pool width constraint
  const A4_POOL_WIDTH = 1122

  // Lock pool width to A4 and prevent pool horizontal move
  const enforcePoolConstraints = useCallback((modeler: InstanceType<typeof BpmnJS>) => {
    try {
      const eventBus = modeler.get('eventBus') as BpmnEventBus
      const modeling = modeler.get('modeling') as BpmnModeling

      // Prevent resizing participant width (only allow height changes)
      eventBus.on('resize.end', 500, (event: BpmnEvent) => {
        const shape = event.shape
        if (shape?.type === 'bpmn:Participant' && shape.width !== A4_POOL_WIDTH) {
          modeling.resizeShape(shape, {
            x: shape.x ?? 0,
            y: shape.y ?? 0,
            width: A4_POOL_WIDTH,
            height: shape.height ?? 0,
          })
        }
      })

      // Lock pool horizontal position. Reentrancy guard prevents the
      // modeling.moveShape call below from triggering this handler again.
      let lockingPool = false
      eventBus.on('shape.move.end', (event: BpmnEvent) => {
        if (lockingPool) return
        const shape = event.shape
        if (shape?.type === 'bpmn:Participant' && shape.x !== 0 && shape.x !== undefined) {
          lockingPool = true
          try {
            modeling.moveShape(shape, { x: -shape.x, y: 0 })
          } finally {
            lockingPool = false
          }
        }
      })
    } catch (err) {
      console.warn('[BpmnModeler] Could not set pool constraints:', err)
    }
  }, [])

  // Apply visual overlays for custom Control/Risk nodes
  const applyRiskOverlays = useCallback((modeler: InstanceType<typeof BpmnJS>) => {
    try {
      const eventBus = modeler.get('eventBus') as BpmnEventBus
      const overlays = modeler.get('overlays') as BpmnOverlays

      const addControlOverlay = (element: BpmnElement) => {
        try {
          overlays.add(element.id, 'risk-control', {
            position: { top: -4, left: -4 },
            html: `<div style="
              position:absolute; top:0; left:0;
              width:${(element.width ?? 0) + 8}px; height:${(element.height ?? 0) + 8}px; border: 2px solid #10b981; border-radius: 14px; pointer-events: none; opacity: 0.7; "></div>`,
          })
          overlays.add(element.id, 'risk-control-badge', {
            position: { top: -8, right: -8 },
            html: `<div style=" width:16px; height:16px; border-radius:50%; background:#10b981; display:flex;
              align-items:center; justify-content:center; font-size:9px; color:#ffffff; font-weight:bold;
              ">C</div>`,
          })
        } catch { /* overlay may already exist */ }
      }

      const addRiskOverlay = (element: BpmnElement) => {
        try {
          overlays.add(element.id, 'risk-marker', {
            position: { top: -8, left: -8 },
            html: `<div style=" width:16px; height:16px; border-radius:50%; background:#ef4444; display:flex;
              align-items:center; justify-content:center; font-size:10px; color:white; font-weight:bold;
              ">!</div>`,
          })
        } catch { /* overlay may already exist */ }
      }

      // Listen for shape additions
      eventBus.on('shape.added', (event: BpmnEvent) => {
        const element = event.element
        if (!element?.businessObject) return
        const name = element.businessObject.name || ''
        // Detect custom control/risk nodes by name prefix convention
        if (name.startsWith('[Control]') || name.startsWith('[C]')) {
          addControlOverlay(element)
        } else if (name.startsWith('[Riesgo]') || name.startsWith('[R]')) {
          addRiskOverlay(element)
        }
      })

      // Also decorate on name change
      eventBus.on('element.changed', (event: BpmnEvent) => {
        const element = event.element
        if (!element?.businessObject) return
        const name = element.businessObject.name || ''
        // Remove old overlays first
        try { overlays.remove({ element: element.id, type: 'risk-control' }) } catch {
          // overlay puede no existir; remoción idempotente
        }
        try { overlays.remove({ element: element.id, type: 'risk-control-badge' }) } catch {
          // overlay puede no existir; remoción idempotente
        }
        try { overlays.remove({ element: element.id, type: 'risk-marker' }) } catch {
          // overlay puede no existir; remoción idempotente
        }

        if (name.startsWith('[Control]') || name.startsWith('[C]')) {
          addControlOverlay(element)
        } else if (name.startsWith('[Riesgo]') || name.startsWith('[R]')) {
          addRiskOverlay(element)
        }
      })
    } catch (err) {
      console.warn('[BpmnModeler] Could not install risk overlays:', err)
    }
  }, [])

  // Initialize modeler or viewer según readOnly.
  // Se re-ejecuta (con cleanup) cada vez que readOnly cambia:
  // true  → NavigatedViewer: solo zoom + paneo, sin ninguna herramienta de edición
  // false → Modeler completo con todas las capacidades de edición
  //
  // StrictMode monta 2x en dev: usamos `cancelled` para abortar imports
  // asíncronos si el efecto ya fue limpiado antes de que resuelvan.
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    setReady(false)

    if (readOnly) {
      const viewer = new NavigatedViewer({ container: containerRef.current, additionalModules: [appNodeRendererModule], moddleExtensions: { lp: leanModdle } })
      importWithFallback(viewer as unknown as InstanceType<typeof BpmnJS>, xml, () => !cancelled).then((success) => {
        if (cancelled) return
        if (success) {
          setReady(true)
          applyRiskOverlays(viewer as unknown as InstanceType<typeof BpmnJS>)
          // Tambien en lectura: sin esto el padre se queda con `modeler` en null y
          // (a) la paleta gira para siempre y (b) «Descargar imagen» no hace nada,
          // justo en los documentos publicados, que son los que se exportan.
          // El visor trae `saveSVG`; lo que NO trae es `commandStack`, asi que el
          // padre debe seguir desactivando deshacer/rehacer por `readOnly`.
          onModelerReady?.(viewer as unknown as BpmnModelerInstance)
        }
      })
      return () => {
        cancelled = true
        viewer.destroy()
      }
    }

    const modeler = new BpmnJS({ container: containerRef.current, additionalModules: [appNodeRendererModule], moddleExtensions: { lp: leanModdle } })
    modelerRef.current = modeler
    modeler.on('commandStack.changed', handleChanged)

    importWithFallback(modeler, xml, () => !cancelled).then((success) => {
      if (cancelled) return
      if (success) {
        setReady(true)
        enforcePoolConstraints(modeler)
        const normalizeAll = enforceOrthogonalConnectors(modeler)
        applyRiskOverlays(modeler)
        onModelerReady?.(modeler)
        setTimeout(() => normalizeAll?.(), 150)
      }
    })

    return () => {
      cancelled = true
      modeler.off('commandStack.changed', handleChanged)
      modeler.destroy()
      modelerRef.current = null
    }
  }, [readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-import when XML changes from outside
  useEffect(() => {
    if (!modelerRef.current || !ready) return
    if (internalChangeRef.current) return
    if (xml === xmlRef.current) return

    xmlRef.current = xml
    importWithFallback(modelerRef.current, xml)
  }, [xml, ready, importWithFallback])

  return (
    <div className={`relative ${className || ''}`} style={{ height: '100%', minHeight: '400px' }}>
      {(hidePalette || readOnly) && (
        <style>{`
          .djs-palette { display: none !important; }
        `}</style>
      )}

      {/* A4 Landscape grid overlay */}
      <style>{`
        .bjs-container {
          background-image:
            linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px) !important;
          background-size: 20px 20px !important;
        }
      `}</style>

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/45 rounded-lg">
          <div className="text-center p-6 max-w-sm">
            <p className="text-red-600 text-sm mb-2 font-medium">Error al cargar el diagrama</p>
            <p className="text-gray-400 text-xs mb-4">{error}</p>
            <button
              onClick={() => {
                if (modelerRef.current) {
                  importWithFallback(modelerRef.current, RECOVERY_BPMN).then((ok) => {
                    if (ok) setReady(true)
                  })
                }
              }}
              className="px-4 py-2 text-white text-xs rounded-lg transition-all bg-primary-500 hover:bg-primary-600"
            >
              Crear diagrama nuevo
            </button>
          </div>
        </div>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white rounded-lg">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
            Cargando editor BPMN...
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden border border-gray-100"
        style={{ background: '#ffffff' }}
      />


      {/* Pista de interacción — visible solo cuando el editor está listo y no es solo lectura */}
      {ready && !readOnly && !error && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900/45 rounded-full border border-gray-100 text-[10px] text-gray-400">
            <span>Doble clic en flecha → agregar texto (Sí / No)</span>
            <span className="w-px h-3 bg-gray-100" />
            <span>Doble clic en forma → renombrar</span>
          </div>
        </div>
      )}
    </div>
  )
}

export { RECOVERY_BPMN }
