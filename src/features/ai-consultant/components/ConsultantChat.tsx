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
      <div className="flex-1 overflow-y-auto space-y-3 p-4 scrollbar-thin scrollbar-thumb-gray-300">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user'
                ? 'bg-primary-100 ring-1 ring-primary-500'
                : 'bg-primary-100 ring-1 ring-primary-500'
            }`}>
              {msg.role === 'user'
                ? <User size={14} className="text-primary-600" />
                : <Bot size={14} className="text-primary-600" />
              }
            </div>
            {/* Bubble */}
            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 ${
                msg.role === 'user'
                  ? 'text-gray-900 rounded-br-sm border border-primary-200 bg-primary-100'
                  : 'bg-gray-50 text-gray-900 rounded-bl-sm border border-gray-200'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-primary-700' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 ring-1 ring-primary-500 flex items-center justify-center">
              <Bot size={14} className="text-primary-600" />
            </div>
            <div className="bg-gray-50 rounded-lg rounded-bl-sm px-4 py-3 border border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-500">Analizando...</span>
              </div>
            </div>
          </div>
        )}

        {transcript && isListening && (
          <div className="flex gap-3 flex-row-reverse">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 ring-1 ring-primary-500 flex items-center justify-center">
              <User size={14} className="text-primary-600" />
            </div>
            <div className="max-w-[75%] rounded-lg px-4 py-3 bg-primary-50 text-primary-700 rounded-br-sm border border-primary-200 border-dashed">
              <p className="text-sm italic">{transcript}...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Text input bar */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 flex gap-2 items-center bg-gray-900/45">
        {/* Botón micrófono — solo si el browser lo soporta */}
        {isSpeechSupported && onToggleListen && (
          <button
            type="button"
            onClick={onToggleListen}
            disabled={isProcessing}
            title={isListening ? 'Detener grabación' : 'Hablar con micrófono'}
            className={`p-2.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isListening
                ? 'bg-red-100 text-red-600 border border-red-300 animate-pulse'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-primary-50 hover:text-primary-600 hover:border-primary-300'
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
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-300 transition-all"
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isProcessing}
          className="p-2.5 rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
        >
          {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  )
}
