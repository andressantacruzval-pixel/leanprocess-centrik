import { useParams } from 'react-router-dom'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'

export default function BpmnEditorPage() {
  const { processId } = useParams()

  // Solo se documenta en el nivel más bajo declarado — ver @/lib/processLevels.
  useDocumentableGuard(processId)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Editor BPMN</h1>
      <p className="text-white/40">Proximamente: Editor visual de diagramas de flujo BPMN 2.0.</p>
      <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-12 text-center text-white/20">
        Editor BPMN para el proceso {processId}
      </div>
    </div>
  )
}
