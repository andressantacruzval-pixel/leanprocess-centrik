import { useState } from 'react'
import { Bot, User, Copy, Check, RefreshCw } from 'lucide-react'
import type { CopilotMessage } from '@/stores/copilotStore'
import { WidgetList } from './widgets/WidgetRenderer'
import { Markdown } from './Markdown'
import { useTypewriter } from '../useTypewriter'

interface Props {
  message: CopilotMessage
  streaming?: boolean
  isLastAssistant?: boolean
  onRegenerate?: () => void
}

export function MessageBubble({ message, streaming, isLastAssistant, onRegenerate }: Props) {
  if (message.role === 'user') return <UserBubble text={message.text} />
  return <AssistantBubble message={message} streaming={streaming} isLastAssistant={isLastAssistant} onRegenerate={onRegenerate} />
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end gap-2.5 copilot-fade">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-600 to-blue-600 px-3.5 py-2.5 text-[13.5px] text-white leading-relaxed whitespace-pre-wrap shadow-lg shadow-cyan-500/10">
        {text}
      </div>
      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0"><User size={14} className="text-white/60" /></div>
    </div>
  )
}

function AssistantBubble({ message, streaming, isLastAssistant, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false)
  const revealed = useTypewriter(message.text, !!streaming)

  const copy = async () => {
    try { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* sin permiso de portapapeles */ }
  }

  const showActions = !streaming && message.text.length > 0

  return (
    <div className="flex gap-2.5 copilot-fade">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/25 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
        <Bot size={14} className="text-cyan-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/5 px-3.5 py-2.5">
          <Markdown text={revealed} />
          {streaming && <span className="inline-block w-1.5 h-3.5 bg-cyan-400/70 ml-0.5 animate-pulse align-middle rounded-sm" />}
          {message.widgets && message.widgets.length > 0 && <WidgetList widgets={message.widgets} />}
        </div>
        {showActions && (
          <div className="flex items-center gap-1 mt-1 pl-0.5">
            <ActionBtn onClick={copy} title="Copiar respuesta">{copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}</ActionBtn>
            {isLastAssistant && onRegenerate && (
              <ActionBtn onClick={onRegenerate} title="Volver a generar"><RefreshCw size={12} /> Regenerar</ActionBtn>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="inline-flex items-center gap-1 text-[11px] text-white/35 hover:text-cyan-300 px-1.5 py-0.5 rounded transition-colors">
      {children}
    </button>
  )
}
