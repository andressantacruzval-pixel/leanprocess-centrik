import { useParams } from 'react-router-dom'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'

export default function BpmnEditorPage() {
  const { processId } = useParams()

  // Solo se documenta en el nivel más bajo declarado — ver @/lib/processLevels.
  useDocumentableGuard(processId)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Editor BPMN</h1>
      <p className="text-gray-500">Proximamente: Editor visual de diagramas de flujo BPMN 2.0.</p>
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-12 text-center text-gray-300">
        Editor BPMN para el proceso {processId}
      </div>
    </div>
  )
}
