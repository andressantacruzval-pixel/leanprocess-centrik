import { Bot, User } from 'lucide-react'
import type { CopilotMessage } from '@/stores/copilotStore'
import { WidgetList } from './widgets/WidgetRenderer'

// Renderiza un mensaje. El texto del asistente admite **negritas** simples y
// saltos de línea; el resto va como widgets debajo.
export function MessageBubble({ message, streaming }: { message: CopilotMessage; streaming?: boolean }) {
  const isUser = message.role === 'user'
  if (isUser) {
    return (
      <div className="flex justify-end gap-2.5">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-600 to-blue-600 px-3.5 py-2.5 text-[13.5px] text-white leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0"><User size={14} className="text-white/60" /></div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center shrink-0">
        <Bot size={14} className="text-cyan-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/5 px-3.5 py-2.5">
          <RichText text={message.text} />
          {streaming && <span className="inline-block w-1.5 h-3.5 bg-cyan-400/70 ml-0.5 animate-pulse align-middle" />}
          {message.widgets && message.widgets.length > 0 && <WidgetList widgets={message.widgets} />}
        </div>
      </div>
    </div>
  )
}

// Formato mínimo: **negrita** → <strong>, y respeta saltos de línea.
function RichText({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="text-[13.5px] text-white/85 leading-relaxed space-y-1">
      {lines.map((line, i) => (
        <p key={i}>{renderBold(line)}</p>
      ))}
    </div>
  )
}

function renderBold(line: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}
