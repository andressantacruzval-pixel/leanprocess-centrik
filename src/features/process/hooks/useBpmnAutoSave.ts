import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { dbWrite } from '@/lib/dbWrite'

interface UseBpmnAutoSaveOptions {
  processId: string | undefined
  bpmnXml: string
  blankBpmn: string
  processes: { id: string; bpmn_xml?: string }[]
  updateProcess: (id: string, data: { bpmn_xml: string }) => void
}

export type BpmnAutoSaveStatus = 'idle' | 'pending' | 'saved' | 'error'

export function useBpmnAutoSave({
  processId,
  bpmnXml,
  blankBpmn,
  processes,
  updateProcess,
}: UseBpmnAutoSaveOptions): BpmnAutoSaveStatus {
  const [autoSaveStatus, setAutoSaveStatus] = useState<BpmnAutoSaveStatus>('idle')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // setState en effect es intencional: marca el indicador visual 'pending'
  // inmediatamente al detectar cambios y luego 'saved'/'error' tras el debounce.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!processId || !bpmnXml || bpmnXml === blankBpmn) return
    const stored = processes.find((p) => p.id === processId)
    if (!stored || bpmnXml === stored.bpmn_xml) return

    setAutoSaveStatus('pending')

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (fadeTimer.current) clearTimeout(fadeTimer.current)

    autoSaveTimer.current = setTimeout(async () => {
      updateProcess(processId, { bpmn_xml: bpmnXml })

      const now = new Date().toISOString()

      // Fuente de verdad: tabla bpmn_diagrams (UNIQUE process_id).
      // La columna legacy processes.bpmn_xml se deja de escribir; solo se
      // mantiene en el store local para mostrar el XML actual sin fetch extra.
      const result = await dbWrite(
        'bpmn:autosave',
        supabase
          .from('bpmn_diagrams')
          .upsert(
            { process_id: processId, diagram_xml: bpmnXml, name: 'Diagrama principal', updated_at: now },
            { onConflict: 'process_id' }
          ),
        {
          // Auto-save corre cada 2s mientras dibujas — no queremos toasts repetidos.
          // El banner visual en el UI (controlado por status='error') es el feedback.
          silent: true,
        }
      )

      if (result.ok) {
        setAutoSaveStatus('saved')
        fadeTimer.current = setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } else {
        setAutoSaveStatus('error')
      }
    }, 2000)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [bpmnXml, processId, processes, updateProcess, blankBpmn])
  /* eslint-enable react-hooks/set-state-in-effect */

  return autoSaveStatus
}
