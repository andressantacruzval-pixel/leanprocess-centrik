/**
 * BPMN XML Parser — extracts structured process data from BPMN 2.0 XML
 * Used by Procedure and Indicators tabs to understand the process diagram
 */

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL'

export interface BpmnActivity {
  id: string
  name: string
  type: 'task' | 'userTask' | 'serviceTask'
  laneName?: string
  order: number
}

export interface BpmnDecision {
  id: string
  name: string
  type: 'exclusiveGateway' | 'parallelGateway'
  laneName?: string
  branches: { label: string; targetId: string }[]
}

export interface BpmnLane {
  id: string
  name: string
  nodeRefs: string[]
}

export interface BpmnSequenceFlow {
  id: string
  name?: string
  sourceRef: string
  targetRef: string
}

export interface ParsedBpmn {
  processName: string
  activities: BpmnActivity[]
  decisions: BpmnDecision[]
  lanes: BpmnLane[]
  sequenceFlows: BpmnSequenceFlow[]
  startEventId?: string
  endEventIds: string[]
  orderedSteps: (BpmnActivity | BpmnDecision)[]
}

function getElements(root: Document | Element, localName: string): Element[] {
  // Try with namespace first, then without
  let els = Array.from(root.getElementsByTagNameNS(BPMN_NS, localName))
  if (els.length === 0) {
    // Fallback: try with prefix patterns
    els = Array.from(root.querySelectorAll(localName))
    if (els.length === 0) {
      // Try all elements and filter by local name
      els = Array.from(root.getElementsByTagName('*')).filter(
        (el) => el.localName === localName || el.localName === `bpmn:${localName}`
      )
    }
  }
  return els
}

function getAttr(el: Element, name: string): string {
  return el.getAttribute(name) || ''
}

export function parseBpmnXml(xml: string): ParsedBpmn {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')

  // Extract lanes
  const lanes: BpmnLane[] = []
  const laneElements = getElements(doc, 'lane')
  for (const lane of laneElements) {
    const nodeRefs: string[] = []
    const refs = getElements(lane, 'flowNodeRef')
    for (const ref of refs) {
      if (ref.textContent) nodeRefs.push(ref.textContent.trim())
    }
    lanes.push({
      id: getAttr(lane, 'id'),
      name: getAttr(lane, 'name') || 'Sin nombre',
      nodeRefs,
    })
  }

  // Helper to find lane for a node
  function findLane(nodeId: string): string | undefined {
    for (const lane of lanes) {
      if (lane.nodeRefs.includes(nodeId)) return lane.name
    }
    return undefined
  }

  // Extract sequence flows
  const sequenceFlows: BpmnSequenceFlow[] = []
  const sfElements = getElements(doc, 'sequenceFlow')
  for (const sf of sfElements) {
    sequenceFlows.push({
      id: getAttr(sf, 'id'),
      name: getAttr(sf, 'name') || undefined,
      sourceRef: getAttr(sf, 'sourceRef'),
      targetRef: getAttr(sf, 'targetRef'),
    })
  }

  // Extract activities
  const activities: BpmnActivity[] = []
  for (const type of ['task', 'userTask', 'serviceTask'] as const) {
    const elements = getElements(doc, type)
    for (const el of elements) {
      activities.push({
        id: getAttr(el, 'id'),
        name: getAttr(el, 'name') || 'Tarea sin nombre',
        type,
        laneName: findLane(getAttr(el, 'id')),
        order: 0,
      })
    }
  }

  // Extract decisions (gateways)
  const decisions: BpmnDecision[] = []
  for (const type of ['exclusiveGateway', 'parallelGateway'] as const) {
    const elements = getElements(doc, type)
    for (const el of elements) {
      const gwId = getAttr(el, 'id')
      const branches = sequenceFlows
        .filter((sf) => sf.sourceRef === gwId && sf.name)
        .map((sf) => ({ label: sf.name!, targetId: sf.targetRef }))

      decisions.push({
        id: gwId,
        name: getAttr(el, 'name') || '',
        type,
        laneName: findLane(gwId),
        branches,
      })
    }
  }

  // Extract start and end events
  const startEvents = getElements(doc, 'startEvent')
  const startEventId = startEvents[0] ? getAttr(startEvents[0], 'id') : undefined
  const endEvents = getElements(doc, 'endEvent')
  const endEventIds = endEvents.map((el) => getAttr(el, 'id'))

  // Build ordered steps by tracing from start event
  const orderedSteps: (BpmnActivity | BpmnDecision)[] = []
  const allNodes = new Map<string, BpmnActivity | BpmnDecision>()
  for (const a of activities) allNodes.set(a.id, a)
  for (const d of decisions) allNodes.set(d.id, d)

  // Build adjacency from sequence flows
  const nextMap = new Map<string, string[]>()
  for (const sf of sequenceFlows) {
    if (!nextMap.has(sf.sourceRef)) nextMap.set(sf.sourceRef, [])
    nextMap.get(sf.sourceRef)!.push(sf.targetRef)
  }

  // BFS from start event
  if (startEventId) {
    const visited = new Set<string>()
    const queue = [startEventId]
    let order = 0

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const node = allNodes.get(current)
      if (node) {
        if ('type' in node && (node.type === 'task' || node.type === 'userTask' || node.type === 'serviceTask')) {
          (node as BpmnActivity).order = order++
        }
        orderedSteps.push(node)
      }

      const nexts = nextMap.get(current) || []
      for (const n of nexts) {
        if (!visited.has(n)) queue.push(n)
      }
    }
  }

  // Process name from collaboration/participant
  let processName = ''
  const participants = getElements(doc, 'participant')
  if (participants[0]) {
    processName = getAttr(participants[0], 'name')
  }

  return {
    processName,
    activities,
    decisions,
    lanes,
    sequenceFlows,
    startEventId,
    endEventIds,
    orderedSteps,
  }
}

// Tipos de nodo que cuentan como "contenido" de un flujograma. Una tarea o una
// compuerta significa que hay proceso dibujado; un lienzo con solo start/end (o
// solo carriles) está vacío para efectos de documentación.
const CONTENT_NODE_TYPES = [
  'task', 'userTask', 'serviceTask', 'sendTask', 'receiveTask',
  'manualTask', 'scriptTask', 'businessRuleTask', 'subProcess', 'callActivity',
  'exclusiveGateway', 'parallelGateway', 'inclusiveGateway', 'eventBasedGateway',
] as const

/**
 * Cuenta los nodos de CONTENIDO (tareas y compuertas) de un XML BPMN sin hacer
 * el BFS completo de parseBpmnXml. Es la salvaguarda anti-borrado del auto-save:
 * bpmn-js RE-SERIALIZA el XML al importarlo (otro espaciado/orden de atributos),
 * así que un lienzo vacío recién cargado ya NO es byte-idéntico a BLANK_BPMN y
 * burlaba la comparación exacta. Contar el contenido es a prueba de reformateo.
 * Ante un XML ilegible devuelve 0 (se tratará como vacío → jamás pisa a uno lleno).
 */
export function countBpmnContentNodes(xml: string): number {
  if (!xml) return 0
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return 0
    let count = 0
    for (const type of CONTENT_NODE_TYPES) count += getElements(doc, type).length
    return count
  } catch {
    return 0
  }
}

/**
 * Converts parsed BPMN data to a human-readable summary for AI consumption
 */
export function bpmnToTextSummary(parsed: ParsedBpmn): string {
  let text = ''
  if (parsed.processName) text += `Proceso: ${parsed.processName}\n\n`

  if (parsed.lanes.length > 0) {
    text += `Roles/Areas:\n`
    parsed.lanes.forEach((l) => { text += `- ${l.name}\n` })
    text += '\n'
  }

  text += `Actividades (en orden de ejecucion):\n`
  parsed.orderedSteps.forEach((step, i) => {
    if ('order' in step && (step as BpmnActivity).type) {
      const a = step as BpmnActivity
      text += `${i + 1}. [${a.laneName || 'Sin rol'}] ${a.name}\n`
    } else {
      const d = step as BpmnDecision
      text += `${i + 1}. DECISION: ${d.name || 'Compuerta'}`
      if (d.branches.length > 0) {
        text += ` → ${d.branches.map((b) => b.label).join(' / ')}`
      }
      text += `\n`
    }
  })

  return text
}
