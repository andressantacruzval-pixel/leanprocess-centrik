import { useState, useCallback } from 'react'
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useCompanyStore } from '@/stores/companyStore'
import { treeToReactFlowNodes } from '@/utils/tree'
import { OrgNode, type OrgNodeData } from './OrgNode'
import { OrgNodeModal } from './OrgNodeModal'
import { OrgToolbar } from './OrgToolbar'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import type { OrgUnit } from '@/types'
import { useEffect } from 'react'

const nodeTypes = { orgNode: OrgNode }

interface OrgChartProps {
  compact?: boolean
  onComplete?: () => void
}

export function OrgChart({ compact }: OrgChartProps) {
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)
  const deleteOrgUnit = useCompanyStore((s) => s.deleteOrgUnit)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Modal state
  const [modalState, setModalState] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    parentId: string | null
    editUnit: OrgUnit | null
  }>({ open: false, mode: 'create', parentId: null, editUnit: null })

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleEdit = useCallback((unit: OrgUnit) => {
    setModalState({ open: true, mode: 'edit', parentId: unit.parent_id, editUnit: unit })
  }, [])

  const handleAddChild = useCallback((parentId: string) => {
    setModalState({ open: true, mode: 'create', parentId, editUnit: null })
  }, [])

  const handleRequestDelete = useCallback((unitId: string) => {
    setDeleteTarget(unitId)
  }, [])

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteOrgUnit(deleteTarget)
      setDeleteTarget(null)
    }
  }, [deleteTarget, deleteOrgUnit])

  const handleAddRoot = useCallback(() => {
    setModalState({ open: true, mode: 'create', parentId: null, editUnit: null })
  }, [])

  const buildLayout = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = treeToReactFlowNodes(orgUnits, orgLevelDefinitions)

    // Inject callbacks into node data
    const enrichedNodes: Node<OrgNodeData>[] = newNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onEdit: handleEdit,
        onAddChild: handleAddChild,
        onDelete: handleRequestDelete,
      },
    }))

    setNodes(enrichedNodes)
    setEdges(newEdges)
  }, [orgUnits, orgLevelDefinitions, handleEdit, handleAddChild, handleRequestDelete, setNodes, setEdges])

  useEffect(() => {
    buildLayout()
  }, [buildLayout])

  const handleAutoLayout = useCallback(() => {
    buildLayout()
  }, [buildLayout])

  return (
    /*
     * Dos usos con necesidades opuestas:
     *
     * · `compact` (paso 4 del alta) va dentro de una columna que se desplaza, sin
     *   altura definida. Ahi hace falta acotarlo o crece sin freno.
     *
     * · La pagina dedicada le da `flex-1` dentro de un `h-full`. Ahi el tope de
     *   `min(700px,70vh)` era el fallo: en una pantalla alta el lienzo se plantaba
     *   en 700px, dejaba un hueco muerto debajo y CORTABA la ultima fila de
     *   unidades. Ahora ocupa lo que el padre le da.
     */
    <div
      className={`flex flex-col w-full ${
        compact
          ? 'h-[min(500px,60vh)] min-h-[320px]'
          : 'flex-1 min-h-[380px]'
      }`}
    >
      <OrgToolbar onAddRoot={handleAddRoot} onAutoLayout={handleAutoLayout} />

      <div className="flex-1 w-full min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1e293b" />
          <Controls position="bottom-right" showInteractive={false} />
          {/* El minimapa mide ~200x150: en un movil ocupa mas de medio viewport y se
              monta sobre el propio diagrama. Solo aparece cuando hay sitio. */}
          {!compact && (
            /* El minimapa de React Flow viene con fondo claro por defecto: sobre este
               tema salia como un rectangulo BLANCO encima del diagrama. */
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!hidden lg:!block !bg-[#0a0f1a] !border !border-white/10 !rounded-lg"
              maskColor="rgba(7, 11, 20, 0.75)"
              nodeColor="#1e293b"
              nodeStrokeColor="#334155"
            />
          )}
        </ReactFlow>
      </div>

      {modalState.open && (
        <OrgNodeModal
          mode={modalState.mode}
          parentId={modalState.parentId}
          editUnit={modalState.editUnit}
          onClose={() => setModalState({ open: false, mode: 'create', parentId: null, editUnit: null })}
        />
      )}

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="¿Eliminar esta unidad organizacional?"
        description="Se eliminarán también todas las unidades dependientes."
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

