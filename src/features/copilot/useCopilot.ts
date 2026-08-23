import { useCallback, useRef, useState } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useCopilotStore } from '@/stores/copilotStore'
import { streamAiProxy, type AiMessage } from '@/lib/aiClient'
import { buildTurnContext } from './copilotContext'
import { buildCopilotSystemPrompt } from './copilotPrompt'
import { extractWidgets, stripForDisplay } from './copilotWidgets'

// Orquesta un turno de consulta: arma contexto de ESTE turno (con memoria de los
// turnos recientes para resolver referencias), hace streaming, limpia marcadores
// en vivo y, al cerrar, extrae los widgets y persiste.

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
  const removeMessage = useCopilotStore((s) => s.removeMessage)

  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  // Genera la respuesta del asistente para una pregunta ya presente como último
  // turno de usuario. `history` son los mensajes previos (sin el turno actual).
  const generate = useCallback(async (convId: string, question: string, history: AiMessage[], assistantId: string) => {
    // Pista de memoria: últimos turnos de usuario para resolver "y sus riesgos?".
    const memoryHint = history.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ')
    const context = buildTurnContext(data, question, memoryHint)
    const systemPrompt = buildCopilotSystemPrompt(companyName, context)

    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)

    let buffer = ''
    try {
      // Mismo camino de streaming probado que el chat de inventario.
      for await (const chunk of streamAiProxy([...history, { role: 'user', content: question }], {
        systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
        signal: controller.signal,
        feature: 'ai_consultant',
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
        const noCredits = err instanceof Error && err.message === 'INSUFFICIENT_CREDITS'
        const msg = noCredits
          ? 'Te has quedado sin créditos de IA. Recárgalos para seguir consultando.'
          : 'No se pudo completar la consulta. Inténtalo de nuevo.'
        setError(msg)
        updateMessage(convId, assistantId, { text: buffer ? stripForDisplay(buffer) : msg })
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
    }
  }, [data, companyName, activeCompanyId, updateMessage])

  const ask = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || isStreaming) return
    setError(null)

    let convId = activeId
    if (!convId || !conversations.some((c) => c.id === convId)) {
      convId = newConversation(activeCompanyId)
    }

    const prior = useCopilotStore.getState().conversations.find((c) => c.id === convId)?.messages ?? []
    const history: AiMessage[] = prior.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.text }))

    addMessage(convId, { role: 'user', text: q })
    const assistantId = addMessage(convId, { role: 'assistant', text: '' })
    await generate(convId, q, history, assistantId)
  }, [isStreaming, activeId, conversations, newConversation, activeCompanyId, addMessage, generate])

  // Regenera la última respuesta: reusa la última pregunta del usuario sin
  // duplicarla, borra la respuesta anterior y vuelve a generar.
  const regenerate = useCallback(async () => {
    if (isStreaming) return
    const conv = useCopilotStore.getState().conversations.find((c) => c.id === activeId)
    if (!conv || !conv.messages.length) return
    const msgs = conv.messages
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user')
    if (lastUserIdx === -1) return
    const userIdx = msgs.length - 1 - lastUserIdx
    const question = msgs[userIdx].text

    // Borra todo lo posterior a esa pregunta (la respuesta anterior).
    for (const m of msgs.slice(userIdx + 1)) removeMessage(conv.id, m.id)

    const history: AiMessage[] = msgs.slice(0, userIdx).slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.text }))
    setError(null)
    const assistantId = addMessage(conv.id, { role: 'assistant', text: '' })
    await generate(conv.id, question, history, assistantId)
  }, [isStreaming, activeId, addMessage, removeMessage, generate])

  return { activeConversation, isStreaming, error, ask, regenerate, stop }
}
