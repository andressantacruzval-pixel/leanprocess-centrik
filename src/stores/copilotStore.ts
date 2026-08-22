import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'

// ─── Copiloto — historial de conversaciones (estilo ChatGPT) ──────────────
// Persistido en localStorage. Cada conversación queda ligada a la empresa
// activa para no mezclar contextos entre workspaces. La v1 vive en el
// navegador; migrar a Supabase (multi-dispositivo) es un cambio aditivo.

/** Marcador de widget emitido por el modelo, ya parseado. */
export interface CopilotWidget {
  name: string // CITE | RISK | PROCESS | CHART
  params: Record<string, string>
}

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  widgets?: CopilotWidget[]
  createdAt: number
}

export interface CopilotConversation {
  id: string
  companyId: string
  title: string
  messages: CopilotMessage[]
  createdAt: number
  updatedAt: number
}

interface CopilotState {
  conversations: CopilotConversation[]
  activeId: string | null

  newConversation: (companyId: string) => string
  setActive: (id: string | null) => void
  addMessage: (conversationId: string, msg: Omit<CopilotMessage, 'id' | 'createdAt'>) => string
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Pick<CopilotMessage, 'text' | 'widgets'>>) => void
  renameConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  clearCompany: (companyId: string) => void
}

const MAX_CONVERSATIONS = 100

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 48 ? t.slice(0, 48) + '…' : t || 'Nueva consulta'
}

export const useCopilotStore = create<CopilotState>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,

      newConversation: (companyId) => {
        const id = generateId()
        const now = Date.now()
        const conv: CopilotConversation = { id, companyId, title: 'Nueva consulta', messages: [], createdAt: now, updatedAt: now }
        set((s) => ({
          conversations: [conv, ...s.conversations].slice(0, MAX_CONVERSATIONS),
          activeId: id,
        }))
        return id
      },

      setActive: (id) => set({ activeId: id }),

      addMessage: (conversationId, msg) => {
        const id = generateId()
        const now = Date.now()
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== conversationId) return c
            const isFirstUser = msg.role === 'user' && c.messages.length === 0
            return {
              ...c,
              title: isFirstUser ? titleFrom(msg.text) : c.title,
              messages: [...c.messages, { ...msg, id, createdAt: now }],
              updatedAt: now,
            }
          }),
        }))
        return id
      },

      updateMessage: (conversationId, messageId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== conversationId
              ? c
              : {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
                }
          ),
        })),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, title: title.trim() || c.title } : c)),
        })),

      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id)
          return { conversations, activeId: s.activeId === id ? null : s.activeId }
        }),

      clearCompany: (companyId) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.companyId !== companyId)
          const activeGone = !conversations.some((c) => c.id === s.activeId)
          return { conversations, activeId: activeGone ? null : s.activeId }
        }),
    }),
    {
      name: 'lean-process-copilot',
      version: 1,
      partialize: (state) => ({ conversations: state.conversations, activeId: state.activeId }),
      migrate: identityMigration(),
    }
  )
)
