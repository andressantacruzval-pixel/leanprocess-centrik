import { useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, Mic, MicOff } from 'lucide-react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

interface ConsultantChatProps {
  messages: ChatMessage[]
  isProcessing: boolean
  transcript: string
  isListening: boolean
  onSendMessage: (text: string) => void
  inputValue: string
  onInputChange: (value: string) => void
  onToggleListen?: () => void
}

export function ConsultantChat({
  messages,
  isProcessing,
  transcript,
  isListening,
  onSendMessage,
  inputValue,
  onInputChange,
  onToggleListen,
}: ConsultantChatProps) {
  const isSpeechSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isProcessing) return
    onSendMessage(text)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 scrollbar-thin scrollbar-thumb-white/10">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user'
                ? 'bg-cyan-500/20 ring-1 ring-cyan-400/30'
                : 'bg-purple-500/20 ring-1 ring-purple-400/30'
            }`}>
              {msg.role === 'user'
                ? <User size={14} className="text-cyan-400" />
                : <Bot size={14} className="text-purple-400" />
              }
            </div>
            {/* Bubble */}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-cyan-600/80 to-blue-700/80 text-white rounded-br-sm backdrop-blur-sm border border-cyan-500/20'
                  : 'bg-white/5 text-gray-100 rounded-bl-sm backdrop-blur-sm border border-white/10'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-cyan-200/60' : 'text-white/30'}`}>
                {msg.timestamp.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 ring-1 ring-purple-400/30 flex items-center justify-center">
              <Bot size={14} className="text-purple-400" />
            </div>
            <div className="bg-white/5 rounded-2xl rounded-bl-sm px-4 py-3 backdrop-blur-sm border border-white/10">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-white/40">Analizando...</span>
              </div>
            </div>
          </div>
        )}

        {transcript && isListening && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 ring-1 ring-cyan-400/30 flex items-center justify-center">
              <User size={14} className="text-cyan-400" />
            </div>
            <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-cyan-500/10 text-cyan-300 rounded-br-sm border border-cyan-500/20 border-dashed">
              <p className="text-sm italic">{transcript}...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Text input bar */}
      <form onSubmit={handleSubmit} className="border-t border-white/10 p-3 flex gap-2 items-center bg-black/20">
        {/* Botón micrófono — solo si el browser lo soporta */}
        {isSpeechSupported && onToggleListen && (
          <button
            type="button"
            onClick={onToggleListen}
            disabled={isProcessing}
            title={isListening ? 'Detener grabación' : 'Hablar con micrófono'}
            className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30'
            }`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={isListening ? 'Hablando...' : 'Escribe tu respuesta...'}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/30 transition-all"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isProcessing}
          className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
        >
          {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  )
}
