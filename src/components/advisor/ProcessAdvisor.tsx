import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { useAdvisorContext } from '@/hooks/useAdvisorContext'
import type { AdvisorContextSummary } from '@/hooks/useAdvisorContext'
import { streamChat, FAST_MODEL } from '@/lib/conversationalAi'
import type { ChatMessage } from '@/lib/conversationalAi'

// ── System prompt builder ────────────────────────────────────────────

function buildSystemPrompt(ctx: AdvisorContextSummary): string {
  return `Eres un asesor experto en gestion de procesos, Lean Six Sigma, mejora continua y gestion de riesgos operacionales. Tu rol es analizar los datos del usuario y dar recomendaciones accionables, concretas y con nombres de procesos especificos.

REGLAS:
- Responde SIEMPRE en espanol.
- Se conciso: maximo 3-4 parrafos por respuesta.
- Sugiere acciones especificas mencionando nombres de procesos.
- Usa terminologia Lean Six Sigma cuando sea relevante.
- Si el usuario no tiene datos, guialo a crear procesos primero.

DATOS ACTUALES DEL USUARIO:
${JSON.stringify({
  total_procesos: ctx.totalProcesses,
  con_bpmn: ctx.processesWithBpmn,
  con_procedimientos: ctx.processesWithProcedures,
  con_kpis: ctx.processesWithKpis,
  con_riesgos: ctx.processesWithRisks,
  procesos_sin_riesgos: ctx.processesWithoutRisks.slice(0, 15),
  procesos_sin_kpis: ctx.processesWithoutKpis.slice(0, 15),
  riesgos_altos: ctx.highRisks.slice(0, 10),
  efectividad_controles: ctx.controlEffectiveness,
  eficiencia_va: ctx.vaEfficiency?.slice(0, 10) ?? null,
  total_riesgos: ctx.totalRisks,
  total_indicadores: ctx.totalIndicators,
}, null, 2)}

Cuando el usuario pregunte algo general, proactivamente menciona hallazgos de sus datos. Por ejemplo: procesos sin riesgos, riesgos criticos sin controles efectivos, procesos sin KPIs, etc.`
}

// ── Types ────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── Component ────────────────────────────────────────────────────────

export function ProcessAdvisor() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const ctx = useAdvisorContext()

  const hasApiKey = !!import.meta.env.VITE_GEMINI_API_KEY

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [open])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsStreaming(true)

    // Build chat history for the API
    const history: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ]

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const systemPrompt = buildSystemPrompt(ctx)
      const stream = streamChat(history, {
        systemPrompt,
        model: FAST_MODEL,
        signal: controller.signal,
        temperature: 0.7,
      })

      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m
          )
        )
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: 'Error al comunicarse con el modelo. Intenta de nuevo.' }
              : m
          )
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, ctx])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort()
    setOpen(false)
  }

  return (
    <>
      {/* ─── Floating button ─── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 bg-primary-500"
        aria-label="Abrir asesor de procesos"
      >
        <MessageCircle size={24} />
        {/* Pulse ring when no messages yet (suggestions available) */}
        {messages.length === 0 && (
          <span className="absolute inset-0 rounded-full bg-primary-100 animate-ping pointer-events-none" />
        )}
      </button>

      {/* ─── Chat panel ─── */}
      {open && (
        <div className="fixed bottom-24 right-4 left-4 sm:left-auto sm:right-6 z-50 w-auto sm:w-[400px] h-[min(500px,70vh)] flex flex-col rounded-lg border border-gray-200 bg-white shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-900/45">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-100">
                <MessageCircle size={16} className="text-primary-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Asesor de Procesos</h2>
                <p className="text-[10px] text-gray-400">Lean Six Sigma &middot; Mejora Continua</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all border border-gray-100"
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {!hasApiKey && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-600">
                No se encontro la API key de Gemini. Configura <code className="bg-gray-100 px-1.5 py-0.5 rounded-md text-[11px]">VITE_GEMINI_API_KEY</code> en tu archivo <code className="bg-gray-100 px-1.5 py-0.5 rounded-md text-[11px]">.env</code> para usar el asesor.
              </div>
            )}

            {hasApiKey && messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-primary-50">
                  <MessageCircle size={20} className="text-primary-600" />
                </div>
                <p className="text-gray-500 text-sm mb-1">Preguntame sobre tus procesos</p>
                <p className="text-gray-300 text-xs max-w-[280px] mx-auto">
                  Puedo analizar riesgos, sugerir KPIs faltantes, evaluar controles y recomendar mejoras.
                </p>
                {/* Quick suggestions */}
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {[
                    'Analiza mis procesos',
                    'Riesgos criticos',
                    'Que me falta?',
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); textareaRef.current?.focus() }}
                      className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 text-xs hover:bg-gray-50 hover:text-gray-600 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'text-gray-900 rounded-br-md bg-primary-100'
                      : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                  {msg.role === 'assistant' && msg.content === '' && isStreaming && (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <Loader2 size={12} className="animate-spin" />
                      <span className="text-xs">Pensando...</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 border-t border-gray-100">
            <div className="flex items-end gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 focus-within:border-primary-300 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                disabled={!hasApiKey || isStreaming}
                rows={1}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 resize-none outline-none max-h-24 disabled:opacity-40"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming || !hasApiKey}
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all bg-primary-500 hover:bg-primary-600"
              >
                {isStreaming ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
