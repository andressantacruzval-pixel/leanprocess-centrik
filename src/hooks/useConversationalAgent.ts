/**
 * useConversationalAgent
 * ----------------------
 * Hook reutilizable para conversaciones en streaming con parseo de
 * tool calls inline. Sirve para el onboarding del mapa de procesos,
 * levantamiento de flujogramas, talleres de riesgos, etc.
 *
 * Responsabilidades:
 *  - Mantener la lista de mensajes (historial)
 *  - Stream el siguiente turno del modelo token a token
 *  - Parsear marcadores <<ACCION ...>> y dispatchar a un handler
 *  - Exponer estado `streaming` para que el UI muestre el cursor
 *  - VERIFICACION AUTOMATICA: tras cada turno, si el caller detecta
 *    que el modelo emitio menos marcadores de los esperados, se
 *    dispara un turno silencioso de correccion que NO se muestra
 *    al usuario pero cuyos marcadores si se dispatchean.
 *
 * Pensado para ser `usado por CUALQUIER flujo conversacional` — no
 * conoce ningun detalle de "mapa de procesos". Las acciones se
 * inyectan via la prop `onToolCall`.
 */

import { useCallback, useRef, useState } from 'react'
import {
  streamChat,
  parseInlineToolCalls,
  type ChatMessage,
  type InlineToolCall,
  type StreamOptions,
} from '@/lib/conversationalAi'

export interface UseConversationalAgentArgs {
  systemPrompt: string
  /** Se llama por cada tool call cuando aparece en el stream. */
  onToolCall?: (call: InlineToolCall) => void
  model?: string
  temperature?: number
  /** Mensaje inicial que envia el modelo al abrir (primera intervencion). */
  greeting?: string
  /** Feature key para logging en ai_usage_log. */
  feature?: string
  /** Empresa activa para scoping del log. */
  companyId?: string
  /**
   * Opcional: devuelve texto extra para appendar al system prompt del
   * proximo turno en base al mensaje del usuario. Permite inyectar
   * pistas dinamicas (ej: "detectado 3 items, debes emitir 3 marcadores").
   */
  augmentSystemPromptForTurn?: (userText: string) => string
  /**
   * Opcional: tras completar un turno, el caller puede revisar cuantos
   * marcadores se dispatcharon y, si faltan, devolver un prompt de
   * correccion que se enviara como turno SILENCIOSO (no aparece en el
   * chat visible, solo se dispatchean sus marcadores).
   *
   * Devolver null si el turno fue correcto y no requiere retry.
   *
   * Limite: 1 sola correccion por turno para evitar loops.
   */
  postTurnVerify?: (ctx: {
    userText: string
    assistantText: string
    dispatchedCallsThisTurn: InlineToolCall[]
  }) => string | null
}

export interface ConversationalAgentApi {
  messages: ChatMessage[]
  streaming: boolean
  draft: string
  sendMessage: (userText: string) => Promise<void>
  /** Arranca la conversacion pidiendo al modelo el primer turno. */
  start: () => Promise<void>
  /** Cancela el stream actual. */
  cancel: () => void
  reset: () => void
}

export function useConversationalAgent(
  args: UseConversationalAgentArgs
): ConversationalAgentApi {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [draft, setDraft] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const dispatchedToolCalls = useRef(new Set<string>())
  // Guardamos la referencia mas reciente de args para evitar cerrar sobre
  // valores stale al ejecutar el retry silencioso (que corre asincrono).
  const argsRef = useRef(args)
  argsRef.current = args

  /**
   * Ejecuta un stream y devuelve el texto final + los calls dispatchados
   * en ESTE turno unicamente. Si `silent` es true, no actualiza draft ni
   * hace commit al historial (solo dispatcha markers). Usado por el retry.
   */
  const runStream = useCallback(
    async (
      nextMessages: ChatMessage[],
      options: {
        silent?: boolean
        extraSystemPrompt?: string
        signal: AbortSignal
      }
    ): Promise<{ finalText: string; dispatched: InlineToolCall[] }> => {
      const { silent = false, extraSystemPrompt = '', signal } = options
      const current = argsRef.current

      // Limpiamos los marcadores dispatched del turno anterior antes de
      // arrancar — el dedupe solo tiene sentido DENTRO del mismo stream.
      dispatchedToolCalls.current.clear()

      const streamOptions: StreamOptions = {
        systemPrompt: current.systemPrompt + extraSystemPrompt,
        temperature: current.temperature,
        model: current.model,
        signal,
        feature: current.feature,
        companyId: current.companyId,
      }

      let buffer = ''
      const dispatchedThisTurn: InlineToolCall[] = []

      for await (const chunk of streamChat(nextMessages, streamOptions)) {
        if (signal.aborted) break
        buffer += chunk

        const { calls, cleanedText } = parseInlineToolCalls(buffer)
        for (const call of calls) {
          if (!dispatchedToolCalls.current.has(call.raw)) {
            dispatchedToolCalls.current.add(call.raw)
            current.onToolCall?.(call)
            dispatchedThisTurn.push(call)
          }
        }
        if (!silent) setDraft(cleanedText)
      }

      const { cleanedText: finalText } = parseInlineToolCalls(buffer)
      return { finalText: finalText.trim(), dispatched: dispatchedThisTurn }
    },
    []
  )

  const streamOne = useCallback(
    async (nextMessages: ChatMessage[]) => {
      setStreaming(true)
      setDraft('')

      const controller = new AbortController()
      abortRef.current = controller

      const current = argsRef.current
      const lastUserMsg =
        [...nextMessages].reverse().find((m) => m.role === 'user')?.content ?? ''

      // Hint dinamico inyectado SOLO para este turno.
      const extraSystemPrompt = current.augmentSystemPromptForTurn
        ? current.augmentSystemPromptForTurn(lastUserMsg)
        : ''

      let finalText = ''
      let allDispatched: InlineToolCall[] = []

      try {
        const first = await runStream(nextMessages, {
          extraSystemPrompt,
          signal: controller.signal,
        })
        finalText = first.finalText
        allDispatched = first.dispatched

        // ── Verificacion post-turno + retry silencioso (1 reintento max) ──
        if (!controller.signal.aborted && current.postTurnVerify) {
          const correctionPrompt = current.postTurnVerify({
            userText: lastUserMsg,
            assistantText: finalText,
            dispatchedCallsThisTurn: allDispatched,
          })

          if (correctionPrompt) {
            // Para el retry, construimos un historial efimero que incluye
            // la respuesta del modelo y un mensaje "user" interno con la
            // instruccion de correccion. NO mutamos el historial visible.
            const ephemeralHistory: ChatMessage[] = [
              ...nextMessages,
              { role: 'assistant', content: finalText },
              { role: 'user', content: correctionPrompt },
            ]
            try {
              const retry = await runStream(ephemeralHistory, {
                silent: true,
                signal: controller.signal,
              })
              // Los markers del retry ya se dispatcharon dentro de runStream.
              allDispatched = [...allDispatched, ...retry.dispatched]
            } catch (err) {
              console.warn('[useConversationalAgent] silent retry failed', err)
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('[useConversationalAgent] stream error', err)
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          finalText = (finalText || '') + `\n\n[Error: ${msg}]`
        }
      } finally {
        // Commit del turno visible. Si el modelo emitio solo marcadores y
        // olvido la oracion conversacional (o el sanitize los dejo vacios),
        // mostramos un fallback minimo basado en cuantos cambios hubo. Asi
        // el usuario nunca ve una burbuja de chat vacia del asistente.
        const visible = finalText.trim()
        const committed = visible || (
          allDispatched.length > 0
            ? `Listo, aplique ${allDispatched.length} cambio${allDispatched.length === 1 ? '' : 's'} al diagrama. ¿Que sigue?`
            : 'Entendido. ¿Como quieres continuar?'
        )
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: committed },
        ])
        setDraft('')
        setStreaming(false)
        abortRef.current = null
      }
    },
    [runStream]
  )

  const sendMessage = useCallback(
    async (userText: string) => {
      const trimmed = userText.trim()
      if (!trimmed || streaming) return

      const next: ChatMessage[] = [
        ...messages,
        { role: 'user', content: trimmed },
      ]
      setMessages(next)
      await streamOne(next)
    },
    [messages, streaming, streamOne]
  )

  const start = useCallback(async () => {
    if (messages.length > 0 || streaming) return
    if (args.greeting) {
      // Si hay greeting hardcoded, mostrar sin llamar al modelo (TTFT = 0).
      setMessages([{ role: 'assistant', content: args.greeting }])
      return
    }
    // Sin greeting hardcoded: pedir al modelo el primer turno.
    await streamOne([{ role: 'user', content: 'Inicia la conversacion.' }])
  }, [args.greeting, messages.length, streaming, streamOne])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }, [])

  const reset = useCallback(() => {
    cancel()
    setMessages([])
    setDraft('')
    dispatchedToolCalls.current.clear()
  }, [cancel])

  return { messages, streaming, draft, sendMessage, start, cancel, reset }
}
