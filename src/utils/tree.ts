import dagre from 'dagre'
import type { Node, Edge } from 'reactflow'
import type { OrgUnit, OrgLevelDefinition } from '@/types'

export interface TreeNode {
  unit: OrgUnit
  children: TreeNode[]
}

export function flatToTree(units: OrgUnit[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const unit of units) {
    map.set(unit.id, { unit, children: [] })
  }

  for (const unit of units) {
    const node = map.get(unit.id)!
    if (unit.parent_id && map.has(unit.parent_id)) {
      map.get(unit.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sort_order
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.unit.sort_order - b.unit.sort_order)
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  return roots
}

export function getNodeDepth(unitId: string, units: OrgUnit[]): number {
  const unitMap = new Map<string, OrgUnit>()
  for (const u of units) unitMap.set(u.id, u)

  let depth = 0
  let current = unitMap.get(unitId)
  while (current?.parent_id) {
    depth++
    current = unitMap.get(current.parent_id)
  }
  return depth
}

export function getAllDescendantIds(unitId: string, units: OrgUnit[]): string[] {
  const childrenMap = new Map<string, string[]>()
  for (const u of units) {
    if (u.parent_id) {
      const existing = childrenMap.get(u.parent_id) ?? []
      existing.push(u.id)
      childrenMap.set(u.parent_id, existing)
    }
  }

  const result: string[] = []
  const stack = [unitId]
  while (stack.length > 0) {
    const current = stack.pop()!
    const children = childrenMap.get(current) ?? []
    for (const childId of children) {
      result.push(childId)
      stack.push(childId)
    }
  }
  return result
}

export function getAllAncestorIds(unitId: string, units: OrgUnit[]): string[] {
  const unitMap = new Map<string, OrgUnit>()
  for (const u of units) unitMap.set(u.id, u)

  const result: string[] = []
  let current = unitMap.get(unitId)
  while (current?.parent_id) {
    result.push(current.parent_id)
    current = unitMap.get(current.parent_id)
  }
  return result
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 80

export function treeToReactFlowNodes(
  units: OrgUnit[],
  levelDefs: OrgLevelDefinition[]
): { nodes: Node[]; edges: Edge[] } {
  if (units.length === 0) return { nodes: [], edges: [] }

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 })

  for (const unit of units) {
    g.setNode(unit.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  for (const unit of units) {
    if (unit.parent_id) {
      g.setEdge(unit.parent_id, unit.id)
    }
  }

  dagre.layout(g)

  const nodes: Node[] = units.map((unit) => {
    const pos = g.node(unit.id)
    const depth = getNodeDepth(unit.id, units)
    const levelDef = levelDefs.find((ld) => ld.level_number === depth) ?? null

    return {
      id: unit.id,
      type: 'orgNode',
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: {
        unit,
        levelDef,
        depth,
      },
    }
  })

  const edges: Edge[] = units
    .filter((u) => u.parent_id)
    .map((u) => ({
      id: `e-${u.parent_id}-${u.id}`,
      source: u.parent_id!,
      target: u.id,
      type: 'smoothstep',
      style: { stroke: '#94a3b8', strokeWidth: 2 },
    }))

  return { nodes, edges }
}
