import { useMemo } from 'react'
import { Bot, Pencil, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCopilotStore } from '@/stores/copilotStore'
import { useCopilot } from '../useCopilot'
import { ConversationRail } from '../components/ConversationRail'
import { ChatThread } from '../components/ChatThread'

// Página del Copiloto: riel de conversaciones + hilo de chat con widgets.
export default function CopilotPage() {
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId) ?? ''
  const allConversations = useCopilotStore((s) => s.conversations)
  const activeId = useCopilotStore((s) => s.activeId)
  const newConversation = useCopilotStore((s) => s.newConversation)
  const setActive = useCopilotStore((s) => s.setActive)
  const renameConversation = useCopilotStore((s) => s.renameConversation)
  const deleteConversation = useCopilotStore((s) => s.deleteConversation)

  const conversations = useMemo(
    () => allConversations.filter((c) => c.companyId === activeCompanyId).sort((a, b) => b.updatedAt - a.updatedAt),
    [allConversations, activeCompanyId]
  )

  const { activeConversation, isStreaming, error, ask, regenerate, stop } = useCopilot()

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white leading-none">Copiloto</h1>
          <p className="text-[11px] text-white/40 mt-1 truncate">
            {activeConversation ? activeConversation.title : 'Consulta toda tu documentación de procesos en lenguaje natural'}
          </p>
        </div>
        {activeConversation && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const t = window.prompt('Nuevo nombre de la consulta:', activeConversation.title)
                if (t && t.trim()) renameConversation(activeConversation.id, t.trim())
              }}
              title="Renombrar consulta"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/60 bg-white/5 border border-white/10 hover:text-cyan-300 hover:border-cyan-500/30 transition-colors"
            >
              <Pencil size={13} /> <span className="hidden sm:inline">Renombrar</span>
            </button>
            <button
              onClick={() => { if (window.confirm('¿Eliminar esta consulta?')) deleteConversation(activeConversation.id) }}
              title="Eliminar consulta"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/60 bg-white/5 border border-white/10 hover:text-red-300 hover:border-red-500/30 transition-colors"
            >
              <Trash2 size={13} /> <span className="hidden sm:inline">Eliminar</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0 rounded-2xl border border-white/5 overflow-hidden">
        <ConversationRail
          conversations={conversations}
          activeId={activeId}
          onNew={() => newConversation(activeCompanyId)}
          onSelect={setActive}
          onRename={renameConversation}
          onDelete={deleteConversation}
        />
        <ChatThread
          conversation={activeConversation}
          isStreaming={isStreaming}
          error={error}
          onSend={ask}
          onStop={stop}
          onRegenerate={regenerate}
        />
      </div>
    </div>
  )
}
