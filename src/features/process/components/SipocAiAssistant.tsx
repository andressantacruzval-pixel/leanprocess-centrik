import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, X, Loader2, Check } from 'lucide-react'
import { interviewSipoc, type SipocAiContext, type SipocTurn } from '@/lib/sipocAi'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

interface Props {
  /** Se llama en cada turno para leer el contexto FRESCO (incluye lo ya registrado). */
  getContext: () => SipocAiContext
  /** Añade los pares nuevos a la tabla (deduplica y resalta). Devuelve cuántos añadió. */
  onAdd: (add: SipocTurn['add']) => number
  onClose: () => void
}

// Asistente conversacional inline: hace pocas preguntas y va poblando el SIPOC.
export function SipocAiAssistant({ getContext, onAdd, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  // Arranque: la IA hace la primera pregunta sola (entiende el proceso del contexto).
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void runTurn([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const runTurn = async (history: ChatMsg[]) => {
    setLoading(true)
    setError(null)
    setQuickReplies([])
    try {
      const turn = await interviewSipoc(getContext(), history.map((m) => ({ role: m.role, content: m.text })))
      const added = onAdd(turn.add)
      if (added > 0) setAddedCount((n) => n + added)
      if (turn.reply) setMessages((prev) => [...prev, { role: 'assistant', text: turn.reply }])
      setQuickReplies(turn.quickReplies ?? [])
      if (turn.done) setDone(true)
    } catch (err) {
      console.warn('[SipocAiAssistant] turn error', err)
      const noCredits = err instanceof Error && err.message.includes('INSUFFICIENT_CREDITS')
      setError(noCredits ? 'Te quedaste sin créditos de IA.' : 'No pude continuar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const send = (text: string) => {
    const t = text.trim()
    if (!t || loading) return
    const next = [...messages, { role: 'user' as const, text: t }]
    setMessages(next)
    setInput('')
    void runTurn(next)
  }

  return (
    <div className="mb-4 rounded-lg border border-primary-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 bg-primary-500">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary-100 flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-primary-700" />
          </div>
          <span className="text-[13px] font-semibold text-gray-900 truncate">Asistente SIPOC</span>
          <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-gray-500">· <TokenCostBadge operationKey="sipoc" /> por respuesta</span>
          {addedCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-primary-700 bg-primary-50 border border-primary-200 px-1.5 py-0.5 rounded-full">
              <Check size={10} /> {addedCount} {addedCount === 1 ? 'agregado' : 'agregados'}
            </span>
          )}
        </div>
        <button onClick={onClose} title="Cerrar asistente" className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Conversación */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-[12.5px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-100 text-gray-900 rounded-br-sm'
                  : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 text-[12px]">
              <Loader2 size={13} className="animate-spin" /> Pensando...
            </div>
          </div>
        )}
        {error && <p className="text-[12px] text-red-600 px-1">{error}</p>}
      </div>

      {/* Quick replies */}
      {quickReplies.length > 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {quickReplies.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              className="text-[11.5px] px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Entrada / cierre */}
      {done ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-emerald-50">
          <span className="flex items-center gap-1.5 text-[12px] text-emerald-700">
            <Check size={14} /> SIPOC listo. Puedes editarlo en la tabla o seguir escribiendo.
          </span>
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors">
            Cerrar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(input) } }}
            disabled={loading}
            placeholder="Escribe tu respuesta..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary-300 disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-white transition-all disabled:opacity-40 bg-primary-500 hover:bg-primary-600"
            title="Enviar"
          >
            <Send size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
