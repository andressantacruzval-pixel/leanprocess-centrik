/**
 * flowchartGraph
 * --------------
 * Modelo en memoria de un flujograma tipo BPMN simplificado con
 * soporte de multiples lanes (roles) y generador determinista de
 * XML BPMN 2.0 con layout automatico via dagre.
 *
 * Diseno:
 *  - El graph se construye incrementalmente desde tool calls de la IA
 *    (ADD_TASK, ADD_GATEWAY, ADD_BRANCH, ADD_END, ADD_LANE,
 *    ASSIGN_LANE, DELETE_LANE, RENAME, DELETE, ...).
 *  - Mantiene un "cursor" apuntando al ultimo nodo insertado, de modo
 *    que ADD_TASK en secuencia construye un flujo lineal sin que la IA
 *    tenga que referenciar ids.
 *  - Multi-lane: cada nodo pertenece a una lane (rol). Cuando se
 *    agrega un nodo sin lane explicita, hereda la lane del cursor.
 *  - Para el layout, dagre calcula las x (flujo) y la y la forzamos
 *    segun el indice de lane, creando bandas horizontales.
 *  - El Start Event se crea automaticamente al iniciar el graph en
 *    la primera lane ("Rol 1"), la IA solo agrega mas lanes, tareas,
 *    compuertas y fines.
 */

import dagre from 'dagre'

export type NodeType = 'startEvent' | 'task' | 'endEvent' | 'gateway'

export interface Lane {
  id: string
  name: string
}

export interface FlowNode {
  id: string
  type: NodeType
  name: string
  laneId: string
}

export interface FlowEdge {
  id: string
  sourceId: string
  targetId: string
  label?: string
}

export interface FlowchartGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
  lanes: Lane[]
  /** Id del ultimo nodo insertado. Nuevas inserciones conectan desde aqui por defecto. */
  cursorId: string | null
  counters: Record<NodeType, number>
  edgeCounter: number
  laneCounter: number
}

// ─── Construccion y mutaciones ────────────────────────────────────────────

/**
 * Nombre por defecto de la primera lane que se crea al inicializar
 * el graph. Es un placeholder — cuando el usuario agrega su primer
 * rol real, esta lane se absorbe (rename) automaticamente.
 */
export const DEFAULT_PLACEHOLDER_LANE_NAME = 'Rol 1'

export function createGraph(): FlowchartGraph {
  const defaultLane: Lane = { id: 'Lane_1', name: DEFAULT_PLACEHOLDER_LANE_NAME }
  const start: FlowNode = {
    id: 'StartEvent_1',
    type: 'startEvent',
    name: 'Inicio',
    laneId: defaultLane.id,
  }
  return {
    nodes: [start],
    edges: [],
    lanes: [defaultLane],
    cursorId: start.id,
    counters: { startEvent: 1, task: 0, endEvent: 0, gateway: 0 },
    edgeCounter: 0,
    laneCounter: 1,
  }
}

function cloneGraph(g: FlowchartGraph): FlowchartGraph {
  return {
    nodes: g.nodes.map((n) => ({ ...n })),
    edges: g.edges.map((e) => ({ ...e })),
    lanes: g.lanes.map((l) => ({ ...l })),
    cursorId: g.cursorId,
    counters: { ...g.counters },
    edgeCounter: g.edgeCounter,
    laneCounter: g.laneCounter,
  }
}

function nextNodeId(g: FlowchartGraph, type: NodeType): string {
  g.counters[type] += 1
  const prefix = {
    startEvent: 'StartEvent',
    task: 'Task',
    endEvent: 'EndEvent',
    gateway: 'Gateway',
  }[type]
  return `${prefix}_${g.counters[type]}`
}

function nextEdgeId(g: FlowchartGraph): string {
  g.edgeCounter += 1
  return `Flow_${g.edgeCounter}`
}

function nextLaneId(g: FlowchartGraph): string {
  g.laneCounter += 1
  return `Lane_${g.laneCounter}`
}

/**
 * Normaliza un nombre para comparacion tolerante: minusculas, sin
 * acentos, sin puntuacion final, colapso de espacios. Asi "Evaluar
 * presupuesto" matchea con "Evaluar presupuesto?" o "Evaluar el
 * presupuesto" (este ultimo via includes como fallback).
 */
function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[?!.,;:]+$/g, '') // quita puntuacion final
    .replace(/\s+/g, ' ')
}

function findByName(g: FlowchartGraph, name: string): FlowNode | null {
  if (!name) return null
  const target = normalizeName(name)
  if (!target) return null
  // 1) Match exacto normalizado
  const exact = g.nodes.find((n) => normalizeName(n.name) === target)
  if (exact) return exact
  // 2) Fallback: alguno incluye al otro (tolerante a "el", "la", etc.)
  const partial = g.nodes.find((n) => {
    const nn = normalizeName(n.name)
    return nn.includes(target) || target.includes(nn)
  })
  return partial ?? null
}

/**
 * Detecta si una lane es el placeholder por defecto ("Rol 1" vacio).
 * Una lane es placeholder si (a) tiene el nombre default Y
 * (b) solo contiene nodos de tipo startEvent (Inicio) — es decir,
 * el usuario no ha agregado nada real dentro todavia.
 */
function isDefaultPlaceholderLane(g: FlowchartGraph, lane: Lane): boolean {
  if (lane.name !== DEFAULT_PLACEHOLDER_LANE_NAME) return false
  const nodesInLane = g.nodes.filter((n) => n.laneId === lane.id)
  return nodesInLane.every((n) => n.type === 'startEvent')
}

/**
 * Intenta absorber el placeholder "Rol 1" renombrandolo al nombre del
 * primer rol real que el usuario quiere crear. Devuelve la lane
 * resultante si absorbio, o null si no aplica.
 *
 * Condicion: existe exactamente UN lane, se llama "Rol 1" y esta vacio.
 * Al absorber, el cursor conserva su ubicacion (Inicio sigue en la lane
 * renombrada) — asi el primer paso del usuario queda en el rol correcto.
 */
function absorbPlaceholderIfPossible(
  g: FlowchartGraph,
  newName: string
): Lane | null {
  if (g.lanes.length !== 1) return null
  const first = g.lanes[0]
  if (!isDefaultPlaceholderLane(g, first)) return null
  first.name = newName.trim()
  return first
}

function findLaneByName(g: FlowchartGraph, name: string): Lane | null {
  if (!name) return null
  const target = normalizeName(name)
  if (!target) return null
  // Solo match EXACTO para lanes. El matching tolerante via `includes`
  // que usamos para nodos es peligroso aqui: "jefe de marketing"
  // matchearia con una lane existente "marketing" porque el string
  // contiene el otro, llevando a que el segundo ADD_LANE no cree nada.
  // Lanes son cortas y controladas — exact normalized match basta.
  const exact = g.lanes.find((l) => normalizeName(l.name) === target)
  return exact ?? null
}

/**
 * Resuelve a que lane debe pertenecer un nodo nuevo:
 *  - Si se especifico laneName y existe, esa.
 *  - Si se especifico laneName y NO existe, la crea on-the-fly.
 *  - Si no se especifico, hereda del nodo cursor.
 *  - Fallback: primera lane.
 */
function resolveLaneId(
  g: FlowchartGraph,
  laneName?: string
): { laneId: string; lanesChanged: boolean } {
  if (laneName && laneName.trim()) {
    const existing = findLaneByName(g, laneName)
    if (existing) return { laneId: existing.id, lanesChanged: false }
    // ── Absorcion del placeholder antes de crear nueva lane ──
    // Si alguien llama ADD_TASK con lane="Marketing" y el graph solo
    // tiene Rol 1 placeholder, absorbemos Rol 1 en lugar de dejarlo
    // colgado al lado de Marketing.
    const absorbed = absorbPlaceholderIfPossible(g, laneName)
    if (absorbed) return { laneId: absorbed.id, lanesChanged: true }
    // Crear nueva
    const id = nextLaneId(g)
    g.lanes.push({ id, name: laneName.trim() })
    return { laneId: id, lanesChanged: true }
  }
  // Heredar de cursor
  const cursor = g.nodes.find((n) => n.id === g.cursorId)
  if (cursor) return { laneId: cursor.laneId, lanesChanged: false }
  // Fallback
  return { laneId: g.lanes[0]?.id ?? 'Lane_1', lanesChanged: false }
}

export interface AddNodeResult {
  graph: FlowchartGraph
  node: FlowNode | null
  /** true si se creo algo nuevo, false si fue idempotente o fallo. */
  created: boolean
}

/**
 * Agrega un nodo (task, gateway o endEvent) al grafo y lo conecta
 * desde `afterName` (o del cursor si se omite). Opcionalmente se
 * puede asignar a una lane especifica (creandola si no existe).
 */
export function addNode(
  g: FlowchartGraph,
  type: Exclude<NodeType, 'startEvent'>,
  name: string,
  opts: { afterName?: string; edgeLabel?: string; laneName?: string } = {}
): AddNodeResult {
  const next = cloneGraph(g)
  const trimmed = name.trim()
  if (!trimmed) return { graph: next, node: null, created: false }

  // Idempotencia: si ya existe con mismo nombre y tipo, solo mover cursor.
  // Si ademas se especifico lane, reasignarlo.
  const existing = findByName(next, trimmed)
  if (existing && existing.type === type) {
    if (opts.laneName) {
      const { laneId } = resolveLaneId(next, opts.laneName)
      existing.laneId = laneId
    }
    next.cursorId = existing.id
    return { graph: next, node: existing, created: false }
  }

  const { laneId } = resolveLaneId(next, opts.laneName)
  const id = nextNodeId(next, type)
  const node: FlowNode = { id, type, name: trimmed, laneId }
  next.nodes.push(node)

  // Determinar source del edge conector.
  // Si se especifico afterName pero no resuelve (el modelo alucina un nombre
  // que no existe o esta mal escrito), caemos al cursor actual para evitar
  // que el nodo quede huerfano — dagre no sabe colocar nodos sin edges y
  // termina superponiendolos todos en el mismo lugar.
  let sourceId: string | null = null
  if (opts.afterName) {
    const src = findByName(next, opts.afterName)
    if (src) {
      sourceId = src.id
    } else {
      sourceId = next.cursorId
      if (typeof window !== 'undefined') {
        console.warn(
          `[flowchartGraph.addNode] afterName="${opts.afterName}" no existe en el grafo, conectando desde el cursor actual para evitar nodo huerfano.`
        )
      }
    }
  } else {
    sourceId = next.cursorId
  }

  // Evitar edge duplicado exacto (mismo source → target)
  if (sourceId && sourceId !== id) {
    const dup = next.edges.some(
      (e) => e.sourceId === sourceId && e.targetId === id
    )
    if (!dup) {
      next.edges.push({
        id: nextEdgeId(next),
        sourceId,
        targetId: id,
        label: opts.edgeLabel,
      })
    }
  } else if (!sourceId) {
    // Ultima linea de defensa: si no hay cursor (imposible normalmente porque
    // el startEvent siempre existe), conectar desde el primer nodo del grafo
    // que no sea este para evitar superposicion visual.
    const anyExisting = next.nodes.find((n) => n.id !== id)
    if (anyExisting) {
      next.edges.push({
        id: nextEdgeId(next),
        sourceId: anyExisting.id,
        targetId: id,
        label: opts.edgeLabel,
      })
    }
  }

  next.cursorId = id
  return { graph: next, node, created: true }
}

/**
 * Agrega una rama desde una compuerta existente hacia una tarea
 * (creandola si no existe). La nueva tarea se convierte en cursor.
 * Hereda la lane de la compuerta por defecto, o usa la lane indicada.
 */
export function addBranch(
  g: FlowchartGraph,
  fromGatewayName: string,
  label: string,
  targetName: string,
  laneName?: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const gateway = findByName(next, fromGatewayName)
  if (!gateway || gateway.type !== 'gateway') {
    return { graph: next, ok: false }
  }

  let target = findByName(next, targetName)
  if (!target) {
    // Si se indico lane para el target, usarla; si no, heredar de la gateway
    let laneId = gateway.laneId
    if (laneName && laneName.trim()) {
      const res = resolveLaneId(next, laneName)
      laneId = res.laneId
    }
    const id = nextNodeId(next, 'task')
    target = { id, type: 'task', name: targetName.trim(), laneId }
    next.nodes.push(target)
  } else if (laneName && laneName.trim()) {
    // Si el target ya existia y se pide lane, reasignar
    const res = resolveLaneId(next, laneName)
    target.laneId = res.laneId
  }

  // Edge ya existe (caso tipico: el modelo emitio primero ADD_TASK que conecto
  // desde el cursor=gateway sin label, y ahora ADD_BRANCH quiere el mismo edge
  // con label "Si"/"No"). Si el edge existe sin label, actualizarlo con el del
  // branch. Si ya tiene label, respetarlo (no sobreescribir).
  const existing = next.edges.find(
    (e) => e.sourceId === gateway.id && e.targetId === target!.id
  )
  const trimmedLabel = label.trim() || undefined
  if (existing) {
    if (!existing.label && trimmedLabel) {
      existing.label = trimmedLabel
    }
  } else {
    next.edges.push({
      id: nextEdgeId(next),
      sourceId: gateway.id,
      targetId: target.id,
      label: trimmedLabel,
    })
  }

  next.cursorId = target.id
  return { graph: next, ok: true }
}

export function renameNode(
  g: FlowchartGraph,
  oldName: string,
  newName: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const node = findByName(next, oldName)
  if (!node) return { graph: next, ok: false }
  node.name = newName.trim()
  return { graph: next, ok: true }
}

export function deleteNode(
  g: FlowchartGraph,
  name: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const node = findByName(next, name)
  if (!node || node.type === 'startEvent') return { graph: next, ok: false }

  next.nodes = next.nodes.filter((n) => n.id !== node.id)
  next.edges = next.edges.filter(
    (e) => e.sourceId !== node.id && e.targetId !== node.id
  )
  if (next.cursorId === node.id) {
    next.cursorId = next.nodes[next.nodes.length - 1]?.id ?? null
  }
  return { graph: next, ok: true }
}

export function setCursor(
  g: FlowchartGraph,
  name: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const node = findByName(next, name)
  if (!node) return { graph: next, ok: false }
  next.cursorId = node.id
  return { graph: next, ok: true }
}

/**
 * Crea manualmente una conexion entre dos nodos existentes (con
 * etiqueta opcional). Util cuando la IA necesita unir algo que no
 * fluye secuencialmente.
 */
export function connectNodes(
  g: FlowchartGraph,
  fromName: string,
  toName: string,
  label?: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const src = findByName(next, fromName)
  const tgt = findByName(next, toName)
  if (!src || !tgt || src.id === tgt.id) return { graph: next, ok: false }

  const dup = next.edges.some(
    (e) => e.sourceId === src.id && e.targetId === tgt.id
  )
  if (!dup) {
    next.edges.push({
      id: nextEdgeId(next),
      sourceId: src.id,
      targetId: tgt.id,
      label: label?.trim() || undefined,
    })
  }
  return { graph: next, ok: true }
}

/**
 * Elimina la conexion directa entre dos nodos, si existe.
 */
export function disconnectNodes(
  g: FlowchartGraph,
  fromName: string,
  toName: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const src = findByName(next, fromName)
  const tgt = findByName(next, toName)
  if (!src || !tgt) return { graph: next, ok: false }
  const before = next.edges.length
  next.edges = next.edges.filter(
    (e) => !(e.sourceId === src.id && e.targetId === tgt.id)
  )
  return { graph: next, ok: next.edges.length < before }
}

/**
 * Inserta un nodo nuevo en medio de un arco existente A → B, quedando
 * A → nuevo → B. Si el arco no existe lo crea al final.
 */
export function insertBetween(
  g: FlowchartGraph,
  afterName: string,
  beforeName: string,
  type: Exclude<NodeType, 'startEvent'>,
  name: string,
  laneName?: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const trimmed = name.trim()
  if (!trimmed) return { graph: next, ok: false }
  const src = findByName(next, afterName)
  const tgt = findByName(next, beforeName)
  if (!src || !tgt) return { graph: next, ok: false }

  // Crear o reusar el nodo nuevo
  let mid = findByName(next, trimmed)
  if (!mid || mid.type !== type) {
    let laneId = src.laneId
    if (laneName && laneName.trim()) {
      const res = resolveLaneId(next, laneName)
      laneId = res.laneId
    }
    const id = nextNodeId(next, type)
    mid = { id, type, name: trimmed, laneId }
    next.nodes.push(mid)
  } else if (laneName && laneName.trim()) {
    const res = resolveLaneId(next, laneName)
    mid.laneId = res.laneId
  }

  // Eliminar el arco directo A → B si existia
  next.edges = next.edges.filter(
    (e) => !(e.sourceId === src.id && e.targetId === tgt.id)
  )

  // Insertar A → nuevo y nuevo → B (evitando duplicados)
  if (!next.edges.some((e) => e.sourceId === src.id && e.targetId === mid!.id)) {
    next.edges.push({
      id: nextEdgeId(next),
      sourceId: src.id,
      targetId: mid.id,
    })
  }
  if (!next.edges.some((e) => e.sourceId === mid!.id && e.targetId === tgt.id)) {
    next.edges.push({
      id: nextEdgeId(next),
      sourceId: mid.id,
      targetId: tgt.id,
    })
  }

  next.cursorId = mid.id
  return { graph: next, ok: true }
}

// ─── Operaciones sobre lanes (roles / piscinas) ──────────────────────────

/** Agrega una lane nueva. Idempotente por nombre. */
export function addLane(
  g: FlowchartGraph,
  name: string
): { graph: FlowchartGraph; lane: Lane | null; created: boolean } {
  const next = cloneGraph(g)
  const trimmed = name.trim()
  if (!trimmed) return { graph: next, lane: null, created: false }

  const existing = findLaneByName(next, trimmed)
  if (existing) return { graph: next, lane: existing, created: false }

  // ── Absorcion automatica del placeholder "Rol 1" ──
  // Si solo existe el lane default vacio, renombramoslo en lugar de
  // crear uno nuevo. Asi evitamos el bug clasico: usuario pide 3 roles,
  // la IA emite 3 ADD_LANE y queda Rol 1 colgado como 4to carril fantasma.
  const absorbed = absorbPlaceholderIfPossible(next, trimmed)
  if (absorbed) return { graph: next, lane: absorbed, created: true }

  const id = nextLaneId(next)
  const lane: Lane = { id, name: trimmed }
  next.lanes.push(lane)
  return { graph: next, lane, created: true }
}

/** Renombra una lane existente. */
export function renameLane(
  g: FlowchartGraph,
  oldName: string,
  newName: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const lane = findLaneByName(next, oldName)
  if (!lane) return { graph: next, ok: false }
  lane.name = newName.trim()
  return { graph: next, ok: true }
}

/**
 * Elimina una lane. Sus nodos se mueven a la primera lane restante.
 * Si es la ultima lane, no se elimina (el pool debe tener al menos una).
 */
export function deleteLane(
  g: FlowchartGraph,
  name: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const lane = findLaneByName(next, name)
  if (!lane) return { graph: next, ok: false }
  if (next.lanes.length <= 1) return { graph: next, ok: false }

  const remaining = next.lanes.filter((l) => l.id !== lane.id)
  const fallbackLaneId = remaining[0].id

  next.nodes.forEach((n) => {
    if (n.laneId === lane.id) n.laneId = fallbackLaneId
  })
  next.lanes = remaining
  return { graph: next, ok: true }
}

/** Mueve un nodo existente a otra lane (creandola si no existe). */
export function assignNodeToLane(
  g: FlowchartGraph,
  nodeName: string,
  laneName: string
): { graph: FlowchartGraph; ok: boolean } {
  const next = cloneGraph(g)
  const node = findByName(next, nodeName)
  if (!node) return { graph: next, ok: false }
  const { laneId } = resolveLaneId(next, laneName)
  node.laneId = laneId
  return { graph: next, ok: true }
}

// ─── Descripcion del estado para alimentar a la IA ───────────────────────

/**
 * Devuelve una descripcion compacta del graph para inyectar en el
 * systemPrompt. Asi la IA sabe que nodos existen, donde estan, como
 * estan conectados y que lanes hay, evitando duplicados y "olvidos".
 */
export function describeGraph(g: FlowchartGraph): string {
  const typeLabel: Record<NodeType, string> = {
    startEvent: 'INICIO',
    task: 'TAREA',
    endEvent: 'FIN',
    gateway: 'COMPUERTA',
  }

  const lanesList = g.lanes
    .map((l) => {
      const nodesInLane = g.nodes
        .filter((n) => n.laneId === l.id)
        .map((n) => `      - [${typeLabel[n.type]}] "${n.name}"`)
        .join('\n')
      return `  - Lane "${l.name}":\n${nodesInLane || '      (vacia)'}`
    })
    .join('\n')

  const edgesList = g.edges.length
    ? g.edges
        .map((e) => {
          const src = g.nodes.find((n) => n.id === e.sourceId)
          const tgt = g.nodes.find((n) => n.id === e.targetId)
          if (!src || !tgt) return ''
          const label = e.label ? ` [${e.label}]` : ''
          return `  - "${src.name}" →${label} "${tgt.name}"`
        })
        .filter(Boolean)
        .join('\n')
    : '  (sin conexiones)'

  const cursor = g.nodes.find((n) => n.id === g.cursorId)
  const cursorLane = cursor
    ? g.lanes.find((l) => l.id === cursor.laneId)
    : null
  const cursorLine = cursor
    ? `CURSOR actual (desde donde se conectaran nuevas tareas por defecto): "${cursor.name}" (en lane "${cursorLane?.name ?? '?'}")`
    : 'CURSOR actual: ninguno'

  if (g.nodes.length <= 1 && g.edges.length === 0 && g.lanes.length === 1) {
    return `ESTADO ACTUAL: solo existe el evento "Inicio" en la lane "${g.lanes[0].name}". No hay tareas ni compuertas aun.\n${cursorLine}`
  }

  return `ESTADO ACTUAL DEL DIAGRAMA:
Lanes (${g.lanes.length}):
${lanesList}

Conexiones:
${edgesList}

${cursorLine}`
}

// ─── Generacion de BPMN XML con layout dagre + bandas de lane ────────────

const NODE_SIZE: Record<NodeType, { w: number; h: number }> = {
  startEvent: { w: 36, h: 36 },
  task: { w: 110, h: 80 },
  endEvent: { w: 36, h: 36 },
  gateway: { w: 50, h: 50 },
}

const BPMN_TAG: Record<NodeType, string> = {
  startEvent: 'bpmn2:startEvent',
  task: 'bpmn2:task',
  endEvent: 'bpmn2:endEvent',
  gateway: 'bpmn2:exclusiveGateway',
}

const LANE_HEIGHT = 160
const LANE_LABEL_WIDTH = 30 // ancho del tajo vertical con el label de la lane
const POOL_PAD_X = 60 // margen izquierdo del contenido dentro del pool

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function toBpmnXml(g: FlowchartGraph): string {
  // ── Layout con dagre (solo para las x en direccion del flujo) ──────
  const dg = new dagre.graphlib.Graph()
  dg.setGraph({
    rankdir: 'LR',
    nodesep: 45,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  })
  dg.setDefaultEdgeLabel(() => ({}))

  for (const n of g.nodes) {
    const size = NODE_SIZE[n.type]
    dg.setNode(n.id, { width: size.w, height: size.h })
  }
  for (const e of g.edges) {
    dg.setEdge(e.sourceId, e.targetId)
  }
  dagre.layout(dg)

  // Indice de cada lane (para calcular su Y)
  const laneIndex = new Map<string, number>()
  g.lanes.forEach((l, i) => laneIndex.set(l.id, i))

  // Convertir centros → top-left, forzando Y segun la lane del nodo
  const positions = new Map<string, { x: number; y: number }>()
  for (const n of g.nodes) {
    const node = dg.node(n.id)
    if (!node) continue
    const size = NODE_SIZE[n.type]
    const idx = laneIndex.get(n.laneId) ?? 0
    // Y forzada: centrado vertical dentro de la banda de su lane
    const laneTopY = idx * LANE_HEIGHT
    const forcedY = laneTopY + (LANE_HEIGHT - size.h) / 2
    positions.set(n.id, {
      x: Math.round(node.x - size.w / 2 + POOL_PAD_X),
      y: Math.round(forcedY),
    })
  }

  const graphInfo = dg.graph() as { width?: number; height?: number }
  const contentWidth = Math.ceil(graphInfo.width ?? 0)
  const poolWidth = Math.max(1100, contentWidth + POOL_PAD_X * 2 + LANE_LABEL_WIDTH)
  const poolHeight = Math.max(
    LANE_HEIGHT,
    g.lanes.length * LANE_HEIGHT
  )

  // ── Construir el XML ────────────────────────────────────────────────

  // Nodos del proceso con sus incoming/outgoing
  const flowNodesXml = g.nodes
    .map((n) => {
      const tag = BPMN_TAG[n.type]
      const name = escapeXml(n.name)
      const incoming = g.edges
        .filter((e) => e.targetId === n.id)
        .map((e) => `      <bpmn2:incoming>${e.id}</bpmn2:incoming>`)
        .join('\n')
      const outgoing = g.edges
        .filter((e) => e.sourceId === n.id)
        .map((e) => `      <bpmn2:outgoing>${e.id}</bpmn2:outgoing>`)
        .join('\n')
      const inner = [incoming, outgoing].filter(Boolean).join('\n')
      if (inner) {
        return `    <${tag} id="${n.id}" name="${name}">\n${inner}\n    </${tag}>`
      }
      return `    <${tag} id="${n.id}" name="${name}" />`
    })
    .join('\n')

  const edgesXml = g.edges
    .map((e) => {
      const name = e.label ? ` name="${escapeXml(e.label)}"` : ''
      return `    <bpmn2:sequenceFlow id="${e.id}" sourceRef="${e.sourceId}" targetRef="${e.targetId}"${name} />`
    })
    .join('\n')

  // Lane set: una <lane> por cada rol, con sus flowNodeRef
  const laneSetXml = g.lanes
    .map((l) => {
      const refs = g.nodes
        .filter((n) => n.laneId === l.id)
        .map((n) => `        <bpmn2:flowNodeRef>${n.id}</bpmn2:flowNodeRef>`)
        .join('\n')
      return `      <bpmn2:lane id="${l.id}" name="${escapeXml(l.name)}">
${refs}
      </bpmn2:lane>`
    })
    .join('\n')

  // DI shapes para cada lane
  const laneShapesXml = g.lanes
    .map((l, i) => {
      const y = i * LANE_HEIGHT
      const x = LANE_LABEL_WIDTH
      const w = poolWidth - LANE_LABEL_WIDTH
      return `      <bpmndi:BPMNShape id="${l.id}_di" bpmnElement="${l.id}" isHorizontal="true">
        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${LANE_HEIGHT}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>`
    })
    .join('\n')

  const diShapesXml = g.nodes
    .map((n) => {
      const pos = positions.get(n.id)
      if (!pos) return ''
      const size = NODE_SIZE[n.type]
      const labelX = Math.round(pos.x + size.w / 2 - 30)
      const labelY = Math.round(pos.y + size.h + 4)
      return `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">
        <dc:Bounds x="${pos.x}" y="${pos.y}" width="${size.w}" height="${size.h}" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${labelX}" y="${labelY}" width="90" height="20" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`
    })
    .filter(Boolean)
    .join('\n')

  const diEdgesXml = g.edges
    .map((e) => {
      const sPos = positions.get(e.sourceId)
      const tPos = positions.get(e.targetId)
      if (!sPos || !tPos) return ''
      const src = g.nodes.find((n) => n.id === e.sourceId)!
      const tgt = g.nodes.find((n) => n.id === e.targetId)!
      const sSize = NODE_SIZE[src.type]
      const tSize = NODE_SIZE[tgt.type]
      const sx = Math.round(sPos.x + sSize.w)
      const sy = Math.round(sPos.y + sSize.h / 2)
      const tx = Math.round(tPos.x)
      const ty = Math.round(tPos.y + tSize.h / 2)
      return `      <bpmndi:BPMNEdge id="${e.id}_di" bpmnElement="${e.id}">
        <di:waypoint x="${sx}" y="${sy}" />
        <di:waypoint x="${tx}" y="${ty}" />
      </bpmndi:BPMNEdge>`
    })
    .filter(Boolean)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
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
${laneSetXml}
    </bpmn2:laneSet>
${flowNodesXml}
${edgesXml}
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="0" y="0" width="${poolWidth}" height="${poolHeight}" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
${laneShapesXml}
${diShapesXml}
${diEdgesXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`
}
