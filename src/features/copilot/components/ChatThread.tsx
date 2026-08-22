import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import type { CopilotConversation } from '@/stores/copilotStore'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'

const SUGGESTIONS = [
  '¿Cómo se crea un nuevo cliente?',
  'Lista los riesgos sin control adecuado',
  'Gráfico: riesgos operativos sin control por área',
  '¿Qué procesos no tienen indicadores?',
  '¿Qué implicaría cambiar el proceso de compras?',
]

interface Props {
  conversation: CopilotConversation | null
  isStreaming: boolean
  error: string | null
  onSend: (text: string) => void
  onStop: () => void
}

export function ChatThread({ conversation, isStreaming, error, onSend, onStop }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = conversation?.messages ?? []
  const lastText = messages[messages.length - 1]?.text ?? ''

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
            {messages.map((m, i) => (
              <MessageBubble key={m.id} message={m} streaming={isStreaming && i === messages.length - 1 && m.role === 'assistant'} />
            ))}
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
