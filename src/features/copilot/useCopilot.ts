import { useCallback, useRef, useState } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useCopilotStore } from '@/stores/copilotStore'
import { streamChat, type ChatMessage } from '@/lib/conversationalAi'
import { buildTurnContext } from './copilotContext'
import { buildCopilotSystemPrompt } from './copilotPrompt'
import { extractWidgets, stripForDisplay } from './copilotWidgets'

// Orquesta un turno de consulta: arma contexto de ESTE turno, hace streaming,
// va limpiando marcadores en vivo y, al cerrar, extrae los widgets y persiste.

const HISTORY_TURNS = 8 // mensajes previos que se pasan como contexto conversacional

export function useCopilot() {
  const data = useCompanyScopedData()
  const companyName = useCompanyStore((s) => s.company?.name) ?? 'la empresa'
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId) ?? ''

  const conversations = useCopilotStore((s) => s.conversations)
  const activeId = useCopilotStore((s) => s.activeId)
  const newConversation = useCopilotStore((s) => s.newConversation)
  const addMessage = useCopilotStore((s) => s.addMessage)
  const updateMessage = useCopilotStore((s) => s.updateMessage)

  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const ask = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || isStreaming) return
    setError(null)

    // Conversación destino (crea una si no hay activa).
    let convId = activeId
    if (!convId || !conversations.some((c) => c.id === convId)) {
      convId = newConversation(activeCompanyId)
    }

    // Historia previa ANTES de agregar el turno nuevo.
    const prior = useCopilotStore.getState().conversations.find((c) => c.id === convId)?.messages ?? []
    const history: ChatMessage[] = prior
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.text }))

    addMessage(convId, { role: 'user', text: q })
    const assistantId = addMessage(convId, { role: 'assistant', text: '' })

    const context = buildTurnContext(data, q)
    const systemPrompt = buildCopilotSystemPrompt(companyName, context)

    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)

    let buffer = ''
    try {
      for await (const chunk of streamChat([...history, { role: 'user', content: q }], {
        systemPrompt,
        temperature: 0.3,
        signal: controller.signal,
        feature: 'copilot_query',
        companyId: activeCompanyId,
      })) {
        buffer += chunk
        updateMessage(convId, assistantId, { text: stripForDisplay(buffer) })
      }
      const { text, widgets } = extractWidgets(buffer)
      updateMessage(convId, assistantId, { text: text || 'No pude encontrar información sobre eso en tu documentación.', widgets })
    } catch (err) {
      if (controller.signal.aborted) {
        const { text, widgets } = extractWidgets(buffer)
        updateMessage(convId, assistantId, { text: text || '(consulta detenida)', widgets })
      } else {
        console.warn('[useCopilot] stream error', err)
        setError('No se pudo completar la consulta. Inténtalo de nuevo.')
        updateMessage(convId, assistantId, { text: buffer ? stripForDisplay(buffer) : 'Hubo un error al consultar. Inténtalo de nuevo.' })
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
    }
  }, [isStreaming, activeId, conversations, newConversation, activeCompanyId, addMessage, updateMessage, data, companyName])

  return { activeConversation, isStreaming, error, ask, stop }
}
