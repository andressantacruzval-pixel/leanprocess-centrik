import { useEffect, useMemo, useRef } from 'react'
import { Sparkles, Bot } from 'lucide-react'
import type { CopilotConversation } from '@/stores/copilotStore'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'

const SUGGESTIONS = [
  '¿Cómo opera el proceso, quién hace qué paso a paso?',
  'Lista los riesgos sin control adecuado',
  'Muéstrame el mapa de calor de riesgos',
  'Gráfico de pastel de riesgos por nivel',
  '¿Qué procesos no tienen indicadores?',
]

interface Props {
  conversation: CopilotConversation | null
  isStreaming: boolean
  error: string | null
  onSend: (text: string) => void
  onStop: () => void
  onRegenerate: () => void
}

export function ChatThread({ conversation, isStreaming, error, onSend, onStop, onRegenerate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const data = useCompanyScopedData()
  const messages = useMemo(() => conversation?.messages ?? [], [conversation])
  const lastText = messages[messages.length - 1]?.text ?? ''
  const lastMsg = messages[messages.length - 1]

  // "Pensando" con sustancia: transmite que trabaja sobre TU data real.
  const thinkingLabel = useMemo(
    () => `Revisando ${data.processes.length} procesos, ${data.risks.length} riesgos y ${data.indicators.length} indicadores…`,
    [data.processes.length, data.risks.length, data.indicators.length]
  )
  const showThinking = isStreaming && lastMsg?.role === 'assistant' && lastMsg.text.length === 0

  const lastAssistantId = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant')?.id, [messages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, lastText])

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0f19]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center mb-4">
              <Sparkles size={26} className="text-cyan-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Tu copiloto de procesos</h2>
            <p className="text-[13px] text-white/45 mt-1.5">
              Pregúntale lo que sea sobre tu empresa. Conoce tus procesos, quién hace qué, tus riesgos, controles e indicadores — y te lleva al documento.
            </p>
            <div className="flex flex-col gap-2 mt-6 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="text-left text-[13px] text-white/70 bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 hover:bg-white/[0.06] hover:border-cyan-500/25 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((m, i) => {
              const streamingThis = isStreaming && i === messages.length - 1 && m.role === 'assistant'
              if (streamingThis && showThinking) {
                return (
                  <div key={m.id} className="flex gap-2.5 copilot-fade">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/25 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                      <Bot size={14} className="text-cyan-400" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/5 px-3.5 py-2.5 inline-flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce" />
                      </span>
                      <span className="text-[12px] text-white/45">{thinkingLabel}</span>
                    </div>
                  </div>
                )
              }
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streaming={streamingThis}
                  isLastAssistant={!isStreaming && m.role === 'assistant' && m.id === lastAssistantId}
                  onRegenerate={onRegenerate}
                />
              )
            })}
            {error && <p className="text-[12px] text-red-400 text-center">{error}</p>}
          </div>
        )}
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <Composer isStreaming={isStreaming} onSend={onSend} onStop={onStop} />
      </div>
    </div>
  )
}
