/**
 * ConversationalPanel
 * -------------------
 * UI reutilizable de chat conversacional con streaming + voz bidi-
 * reccional. No sabe NADA del dominio — se conecta a un
 * `useConversationalAgent` y muestra:
 *   - historial de mensajes
 *   - burbuja en streaming (cursor parpadeante)
 *   - input con Enter-to-send
 *   - push-to-talk (micrófono manual)
 *   - Modo Voz (ciclo manos libres tipo Jarvis):
 *       usuario habla → silencio → auto-envia → IA habla →
 *       al terminar → mic vuelve a escuchar
 *
 * Pensado para embeber en cualquier split-screen: onboarding mapa,
 * levantamiento de flujograma, taller de riesgos, etc.x
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Send,
  Mic,
  MicOff,
  Square,
  Bot,
  User,
  Zap,
  Headphones,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { ConversationalAgentApi } from '@/hooks/useConversationalAgent'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'

interface Props {
  agent: ConversationalAgentApi
  title?: string
  subtitle?: string
  placeholder?: string
  /** Autostart al montar — emite el greeting o pide primer turno. */
  autoStart?: boolean
  /** Chips de respuestas rapidas (ej: "Retail", "Servicios", "Manufactura"). */
  quickReplies?: string[]
  /** Ocultar la barra de input (modo lectura). */
  hideInput?: boolean
}

export function ConversationalPanel({
  agent,
  title = 'Asistente IA',
  subtitle = 'Respuestas en tiempo real',
  placeholder = 'Escribe o habla...',
  autoStart = true,
  quickReplies,
  hideInput = false,
}: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  // Modo voz: ciclo manos libres (mic + TTS automatico)
  const [voiceMode, setVoiceMode] = useState(false)
  // TTS arranca apagado: Chrome bloquea audio hasta que el usuario
  // haga un gesto directo (click). Se enciende al tocar el toggle.
  const [ttsEnabled, setTtsEnabled] = useState(false)

  // TTS — la IA habla al usuario
  const tts = useSpeechSynthesis({ lang: 'es-ES', rate: 1.1 })
  const ttsRef = useRef(tts)
  useEffect(() => { ttsRef.current = tts }, [tts])

  // Voz entrada — el usuario habla a la IA.
  // silenceMs alto (2200ms) para tolerar micro-pausas del usuario
  // cuando piensa — no queremos cortar en mitad de una frase.
  const speech = useSpeechRecognition({
    lang: 'es-ES',
    silenceMs: 2200,
    onInterim: (text) => setInput(text),
    onFinal: (text) => {
      setInput('')
      if (text.trim()) agent.sendMessage(text)
    },
  })

  // Posicion de lo ya hablado del draft actual (para TTS incremental)
  const spokenCharsRef = useRef(0)

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true
      agent.start()
    }
  }, [autoStart, agent])

  // Auto-scroll al final cuando llegan nuevos tokens
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [agent.messages.length, agent.draft])

  // Reset del puntero de TTS cuando arranca un nuevo stream
  useEffect(() => {
    if (agent.streaming && agent.draft.length === 0) {
      spokenCharsRef.current = 0
    }
  }, [agent.streaming, agent.draft.length])

  // TTS incremental: hablar cada oracion completa del draft apenas llega
  useEffect(() => {
    if (!ttsEnabled || !ttsRef.current.supported) return
    let offset = spokenCharsRef.current
    const draft = agent.draft
    while (true) {
      const unspoken = draft.slice(offset)
      // Match: texto no vacio + puntuacion terminal + espacio/fin
      const m = unspoken.match(/^([\s\S]+?[.!?\n])(\s|$)/)
      if (!m) break
      const sentence = m[1].trim()
      if (sentence) ttsRef.current.speak(sentence)
      offset += m[0].length
    }
    spokenCharsRef.current = offset
  }, [agent.draft, ttsEnabled])

  // Al terminar el stream, hablar cualquier remanente sin puntuacion final
  useEffect(() => {
    if (!ttsEnabled || !ttsRef.current.supported) return
    if (agent.streaming) return
    const last = agent.messages[agent.messages.length - 1]
    if (!last || last.role !== 'assistant') return
    const rest = last.content.slice(spokenCharsRef.current).trim()
    if (rest) {
      ttsRef.current.speak(rest)
      spokenCharsRef.current = last.content.length
    }
  }, [agent.messages, agent.streaming, ttsEnabled])

  // Cancelar TTS en cuanto el usuario envia un nuevo mensaje
  useEffect(() => {
    const last = agent.messages[agent.messages.length - 1]
    if (last?.role === 'user') {
      ttsRef.current.cancel()
      spokenCharsRef.current = 0
    }
  }, [agent.messages])

  // Ciclo manos libres: auto-listen cuando el bot esta en silencio
  useEffect(() => {
    if (!voiceMode || !speech.supported) return
    const busy = agent.streaming || tts.speaking
    if (busy) {
      if (speech.listening) speech.stop()
      return
    }
    if (!speech.listening) {
      // Pequena pausa para evitar capturar el final del TTS o del propio echo
      const t = setTimeout(() => {
        if (!agent.streaming && !ttsRef.current.speaking && !speech.listening) {
          speech.start()
        }
      }, 400)
      return () => clearTimeout(t)
    }
  }, [voiceMode, agent.streaming, tts.speaking, speech.listening, speech.supported, speech])

  const handleSend = () => {
    if (!input.trim() || agent.streaming) return
    const text = input
    setInput('')
    agent.sendMessage(text)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev
      if (!next) {
        // Apagar todo al salir
        ttsRef.current.cancel()
        if (speech.listening) speech.stop()
      } else {
        // Este click ES la interaccion que desbloquea audio en Chrome
        setTtsEnabled(true)
        // Hablar el ultimo mensaje del asistente (ej: el greeting que
        // ya estaba en pantalla antes de activar modo voz)
        const last = agent.messages[agent.messages.length - 1]
        if (last?.role === 'assistant' && last.content.trim()) {
          ttsRef.current.cancel()
          ttsRef.current.speak(last.content)
          spokenCharsRef.current = last.content.length
        }
      }
      return next
    })
  }, [speech, agent.messages])

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <div
          className={`w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 flex items-center justify-center transition-all ${
            tts.speaking
              ? 'ring-cyan-400/70 shadow-lg shadow-cyan-500/30 animate-pulse'
              : 'ring-cyan-500/30'
          }`}
        >
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{title}</span>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300">
              <Zap size={10} />
              Fast mode
            </span>
            {voiceMode && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <Headphones size={10} />
                Modo voz
              </span>
            )}
          </div>
          <div className="text-[11px] text-white/40 truncate">
            {voiceMode
              ? tts.speaking
                ? 'Hablando...'
                : speech.listening
                ? 'Escuchando...'
                : agent.streaming
                ? 'Pensando...'
                : 'Listo, habla cuando quieras'
              : subtitle}
          </div>
        </div>

        {/* Mute TTS */}
        {tts.supported && (
          <button
            onClick={() => {
              if (ttsEnabled) {
                ttsRef.current.cancel()
                setTtsEnabled(false)
              } else {
                setTtsEnabled(true)
                // Hablar el ultimo mensaje del asistente (gesto directo del usuario)
                const last = agent.messages[agent.messages.length - 1]
                if (last?.role === 'assistant' && last.content.trim()) {
                  ttsRef.current.speak(last.content)
                  spokenCharsRef.current = last.content.length
                }
              }
            }}
            title={ttsEnabled ? 'Silenciar voz de la IA' : 'Activar voz de la IA'}
            className={`p-2 rounded-lg transition-colors ${
              ttsEnabled
                ? 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {ttsEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </button>
        )}

        {/* Modo voz manos libres */}
        {speech.supported && tts.supported && (
          <button
            onClick={toggleVoiceMode}
            title={voiceMode ? 'Salir de Modo voz' : 'Activar Modo voz (manos libres)'}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all ${
              voiceMode
                ? 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'
            }`}
          >
            <Headphones size={12} />
            {voiceMode ? 'ON' : 'Modo voz'}
          </button>
        )}

        {agent.streaming && (
          <button
            onClick={agent.cancel}
            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors"
            title="Detener"
          >
            <Square size={12} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {agent.messages.length === 0 && !agent.streaming && (
          <div className="text-center text-white/30 text-xs mt-10">
            Iniciando conversacion...
          </div>
        )}

        {agent.messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} content={m.content} />
        ))}

        {agent.streaming && agent.draft && (
          <MessageBubble role="assistant" content={agent.draft} streaming />
        )}

        {agent.streaming && !agent.draft && (
          <MessageBubble role="assistant" content="" streaming />
        )}
      </div>

      {/* Quick replies */}
      {quickReplies && quickReplies.length > 0 && agent.messages.length <= 2 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-white/5">
          {quickReplies.map((q) => (
            <button
              key={q}
              onClick={() => {
                setInput('')
                agent.sendMessage(q)
              }}
              disabled={agent.streaming}
              className="px-3 py-1.5 text-xs rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 disabled:opacity-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {!hideInput && <div className="p-3 border-t border-white/5 bg-white/[0.02]">
        <div className="flex items-end gap-2">
          <button
            onClick={speech.toggle}
            disabled={!speech.supported || agent.streaming}
            title={
              !speech.supported
                ? 'Voz no disponible en este navegador (usa Chrome o Edge)'
                : speech.listening
                ? 'Escuchando… clic para detener'
                : 'Hablar'
            }
            className={`p-2 rounded-lg transition-all ${
              !speech.supported
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : speech.listening
                ? 'bg-red-500/20 text-red-300 ring-2 ring-red-500/50 animate-pulse'
                : 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/20 disabled:opacity-40'
            }`}
          >
            {speech.supported ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={
              speech.listening ? 'Escuchando… habla ahora' : placeholder
            }
            rows={1}
            disabled={agent.streaming || speech.listening}
            className="flex-1 resize-none px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40 disabled:opacity-60 max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || agent.streaming || speech.listening}
            className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send size={16} />
          </button>
        </div>
        {speech.error && (
          <div className="mt-2 text-[11px] text-red-300/80">
            Error de voz: {speech.error}. Puedes escribir normalmente.
          </div>
        )}
      </div>}
    </div>
  )
}

interface BubbleProps {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

/**
 * Render markdown minimo inline: **negrita**, *cursiva*, guiones como
 * bullets, saltos de linea. Sin dependencias externas para no inflar el
 * bundle. Si el modelo produce markdown complejo (tablas, links), queda
 * como texto plano — el consultor no lo necesita.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    // Detectar bullet ("- item" o "• item" al inicio de linea)
    const bulletMatch = line.match(/^(\s*)[-•]\s+(.*)$/)
    const isBullet = Boolean(bulletMatch)
    const body = isBullet && bulletMatch ? bulletMatch[2] : line

    // Procesar **bold** y *italic* dentro de la linea
    const parts: React.ReactNode[] = []
    let rest = body
    let partIdx = 0
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/
    while (rest.length > 0) {
      const m = rest.match(regex)
      if (!m) {
        parts.push(<span key={`t${partIdx++}`}>{rest}</span>)
        break
      }
      const [full, , bold, italic, code] = m
      const before = rest.slice(0, m.index)
      if (before) parts.push(<span key={`t${partIdx++}`}>{before}</span>)
      if (bold) parts.push(<strong key={`b${partIdx++}`} className="font-semibold text-white">{bold}</strong>)
      else if (italic) parts.push(<em key={`i${partIdx++}`} className="italic text-white/90">{italic}</em>)
      else if (code) parts.push(
        <code key={`c${partIdx++}`} className="px-1 py-0.5 rounded bg-white/10 text-cyan-300 text-[0.9em] font-mono">
          {code}
        </code>
      )
      rest = rest.slice((m.index ?? 0) + full.length)
    }

    if (isBullet) {
      return (
        <div key={`l${li}`} className="flex gap-2 my-0.5">
          <span className="text-cyan-400/70 mt-0.5">•</span>
          <span className="flex-1">{parts}</span>
        </div>
      )
    }
    // Linea vacia = separador visual
    if (line.trim() === '') {
      return <div key={`l${li}`} className="h-2" />
    }
    return <div key={`l${li}`}>{parts}</div>
  })
}

/**
 * Indicador de typing con 3 puntos animados — mas expresivo que un cursor
 * fijo. Se muestra durante el stream cuando aun no llego el primer token
 * o tras detener un mensaje.
 */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

function MessageBubble({ role, content, streaming }: BubbleProps) {
  const isUser = role === 'user'
  return (
    <div
      className={`flex gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
        isUser ? 'flex-row-reverse' : ''
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-white/10 to-white/5 text-white/60 border border-white/10'
            : 'bg-gradient-to-br from-cyan-500/25 to-blue-500/25 ring-1 ring-cyan-500/40 text-cyan-300 shadow-cyan-500/20'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <span className="text-[10px] text-cyan-300/60 font-medium px-1">Consultor</span>
        )}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-gradient-to-br from-cyan-600/25 to-blue-600/20 text-white rounded-tr-sm border border-cyan-500/30'
              : 'bg-white/[0.05] text-white/90 rounded-tl-sm border border-white/10'
          }`}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <div className="space-y-0.5">
              {renderInlineMarkdown(content)}
              {streaming && content.length > 0 && (
                <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-0.5 -mb-0.5 animate-pulse align-middle" />
              )}
              {streaming && content.length === 0 && <TypingDots />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
