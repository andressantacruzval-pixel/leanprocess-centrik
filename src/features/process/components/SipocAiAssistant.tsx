import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, X, Loader2, Check } from 'lucide-react'
import { interviewSipoc, type SipocAiContext, type SipocTurn } from '@/lib/sipocAi'

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
    <div className="mb-4 rounded-xl border border-purple-500/25 bg-gradient-to-b from-purple-500/[0.07] to-transparent overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-purple-300" />
          </div>
          <span className="text-[13px] font-semibold text-white truncate">Asistente SIPOC</span>
          {addedCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-teal-300 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded-full">
              <Check size={10} /> {addedCount} {addedCount === 1 ? 'agregado' : 'agregados'}
            </span>
          )}
        </div>
        <button onClick={onClose} title="Cerrar asistente" className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Conversación */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12.5px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600/80 text-white rounded-br-sm'
                  : 'bg-white/[0.06] text-white/85 border border-white/5 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.06] border border-white/5 text-white/50 text-[12px]">
              <Loader2 size={13} className="animate-spin" /> Pensando...
            </div>
          </div>
        )}
        {error && <p className="text-[12px] text-red-400 px-1">{error}</p>}
      </div>

      {/* Quick replies */}
      {quickReplies.length > 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {quickReplies.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              className="text-[11.5px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-200 border border-purple-500/25 hover:bg-purple-500/20 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Entrada / cierre */}
      {done ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/5 bg-emerald-500/[0.06]">
          <span className="flex items-center gap-1.5 text-[12px] text-emerald-300">
            <Check size={14} /> SIPOC listo. Puedes editarlo en la tabla o seguir escribiendo.
          </span>
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 border border-white/10 transition-colors">
            Cerrar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(input) } }}
            disabled={loading}
            placeholder="Escribe tu respuesta..."
            className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12.5px] text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/40 disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-500 hover:to-cyan-500 transition-all disabled:opacity-40"
            title="Enviar"
          >
            <Send size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
