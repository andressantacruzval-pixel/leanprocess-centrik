import { useMemo } from 'react'
import { Bot } from 'lucide-react'
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

  const { activeConversation, isStreaming, error, ask, stop } = useCopilot()

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 ring-1 ring-cyan-500/30 flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-none">Copiloto</h1>
          <p className="text-[11px] text-white/40 mt-1">Consulta toda tu documentación de procesos en lenguaje natural</p>
        </div>
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
        />
      </div>
    </div>
  )
}
