import { useCallback, useRef, useState } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { useCopilotStore } from '@/stores/copilotStore'
import { streamAiProxy, type AiMessage } from '@/lib/aiClient'
import { buildTurnContext } from './copilotContext'
import { buildCopilotSystemPrompt } from './copilotPrompt'
import { buildDeepDossier, buildDeepResearchPrompt } from './copilotDeepResearch'
import { extractWidgets, stripForDisplay } from './copilotWidgets'
import { groundWidgets } from './copilotGrounding'
import { detectVisual } from './copilotCharts'
import { extractPlan, specToWidget } from './copilotPlan'
import type { CopilotWidget } from '@/stores/copilotStore'

// Orquesta un turno: arma contexto (con memoria de turnos recientes), hace
// streaming, limpia marcadores en vivo y extrae widgets al cerrar. Soporta un
// modo de INVESTIGACIÓN PROFUNDA que recorre toda la empresa.

const HISTORY_TURNS = 8

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
  const [isDeep, setIsDeep] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  // Núcleo de streaming: dado un systemPrompt ya armado, transmite y persiste.
  const runStream = useCallback(async (
    convId: string, question: string, history: AiMessage[], assistantId: string,
    systemPrompt: string, maxOutputTokens: number, deep: boolean,
  ) => {
    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)

    // El visual lo decide una CAPA ESTRUCTURADA: el modelo emite un bloque JSON
    // {widget:...} (robusto) que el sistema ejecuta de forma determinista
    // (agrupación, filtros, inherente/residual, empresa/proceso, números exactos).
    // Respaldo por palabras clave si el modelo omite el bloque. En investigación
    // profunda el informe trae sus propios gráficos inline.
    const finalizeWidgets = (raw: CopilotWidget[], spec: ReturnType<typeof extractPlan>['spec']): CopilotWidget[] => {
      if (deep) return groundWidgets(data, raw)
      const grounded = groundWidgets(data, raw.filter((w) => w.name !== 'CHART' && w.name !== 'HEATMAP'))
      const visual = specToWidget(spec, data) ?? detectVisual(question, data)
      return visual ? [...grounded, visual] : grounded
    }
    const finalize = (buf: string, fallbackText: string) => {
      const { text: stripped, spec } = extractPlan(buf)
      const { text, widgets } = extractWidgets(stripped)
      updateMessage(convId, assistantId, { text: text || fallbackText, widgets: finalizeWidgets(widgets, spec) })
    }

    let buffer = ''
    try {
      for await (const chunk of streamAiProxy([...history, { role: 'user', content: question }], {
        systemPrompt,
        temperature: 0.3,
        maxOutputTokens,
        signal: controller.signal,
        feature: 'ai_consultant',
        companyId: activeCompanyId,
      })) {
        buffer += chunk
        updateMessage(convId, assistantId, { text: stripForDisplay(buffer) })
      }
      finalize(buffer, 'No pude encontrar información sobre eso en tu documentación.')
    } catch (err) {
      if (controller.signal.aborted) {
        finalize(buffer, '(consulta detenida)')
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
      setIsDeep(false)
    }
  }, [activeCompanyId, updateMessage, data])

  const ensureConversation = useCallback((): string => {
    let convId = activeId
    if (!convId || !conversations.some((c) => c.id === convId)) convId = newConversation(activeCompanyId)
    return convId
  }, [activeId, conversations, newConversation, activeCompanyId])

  const ask = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || isStreaming) return
    setError(null)
    const convId = ensureConversation()

    const prior = useCopilotStore.getState().conversations.find((c) => c.id === convId)?.messages ?? []
    const history: AiMessage[] = prior.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.text }))
    const memoryHint = history.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ')

    addMessage(convId, { role: 'user', text: q })
    const assistantId = addMessage(convId, { role: 'assistant', text: '' })
    const systemPrompt = buildCopilotSystemPrompt(companyName, buildTurnContext(data, q, memoryHint))
    await runStream(convId, q, history, assistantId, systemPrompt, 4096, false)
  }, [isStreaming, ensureConversation, addMessage, companyName, data, runStream])

  // Investigación profunda: recorre toda la empresa y entrega un informe.
  const deepResearch = useCallback(async (question: string) => {
    const q = (question || 'Diagnóstico integral de la gestión por procesos de la empresa.').trim()
    if (isStreaming) return
    setError(null)
    setIsDeep(true)
    const convId = ensureConversation()
    addMessage(convId, { role: 'user', text: `🔬 ${q}` })
    const assistantId = addMessage(convId, { role: 'assistant', text: '' })
    const systemPrompt = buildDeepResearchPrompt(companyName, buildDeepDossier(data))
    await runStream(convId, q, [], assistantId, systemPrompt, 8192, true)
  }, [isStreaming, ensureConversation, addMessage, companyName, data, runStream])

  const regenerate = useCallback(async () => {
    if (isStreaming) return
    const conv = useCopilotStore.getState().conversations.find((c) => c.id === activeId)
    if (!conv || !conv.messages.length) return
    const msgs = conv.messages
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user')
    if (lastUserIdx === -1) return
    const userIdx = msgs.length - 1 - lastUserIdx
    const question = msgs[userIdx].text.replace(/^🔬\s*/, '')
    for (const m of msgs.slice(userIdx + 1)) removeMessage(conv.id, m.id)
    const history: AiMessage[] = msgs.slice(0, userIdx).slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.text }))
    setError(null)
    const assistantId = addMessage(conv.id, { role: 'assistant', text: '' })
    const systemPrompt = buildCopilotSystemPrompt(companyName, buildTurnContext(data, question))
    await runStream(conv.id, question, history, assistantId, systemPrompt, 4096, false)
  }, [isStreaming, activeId, addMessage, removeMessage, companyName, data, runStream])

  return { activeConversation, isStreaming, isDeep, error, ask, deepResearch, regenerate, stop }
}
