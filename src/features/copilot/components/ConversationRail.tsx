import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Pencil, Check, X, Search } from 'lucide-react'
import type { CopilotConversation } from '@/stores/copilotStore'

interface Props {
  conversations: CopilotConversation[]
  activeId: string | null
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

// Riel de conversaciones estilo ChatGPT: nueva, buscar, seleccionar, renombrar, borrar.
export function ConversationRail({ conversations, activeId, onNew, onSelect, onRename, onDelete }: Props) {
  const [q, setQ] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const filtered = q.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))
    : conversations

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-100 bg-surface-ground">
      <div className="p-3 space-y-2 border-b border-gray-100">
        <button
          onClick={onNew}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white text-[13px] font-medium hover:opacity-90 transition-opacity bg-primary-500"
        >
          <Plus size={15} /> Nueva consulta
        </button>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-300"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.length === 0 && (
          <p className="text-[11.5px] text-gray-400 text-center px-3 py-6">
            {conversations.length ? 'Sin coincidencias.' : 'Aún no tienes consultas. Empieza una nueva.'}
          </p>
        )}
        {filtered.map((c) => {
          const isActive = c.id === activeId
          const isEditing = c.id === editingId
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                isActive ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'
              }`}
              onClick={() => !isEditing && onSelect(c.id)}
            >
              <MessageSquare size={13} className={`shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
              {isEditing ? (
                <>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { onRename(c.id, draft); setEditingId(null) } }}
                    autoFocus
                    className="flex-1 min-w-0 bg-gray-100 rounded-md px-1.5 py-0.5 text-[12.5px] text-gray-900 focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <IconBtn title="Guardar" onClick={(e) => { e.stopPropagation(); onRename(c.id, draft); setEditingId(null) }}><Check size={12} /></IconBtn>
                  <IconBtn title="Cancelar" onClick={(e) => { e.stopPropagation(); setEditingId(null) }}><X size={12} /></IconBtn>
                </>
              ) : (
                <>
                  <span className={`flex-1 min-w-0 truncate text-[12.5px] ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>{c.title}</span>
                  <div className="shrink-0 flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                    <IconBtn title="Renombrar" onClick={(e) => { e.stopPropagation(); setDraft(c.title); setEditingId(c.id) }}><Pencil size={11} /></IconBtn>
                    <IconBtn title="Eliminar" danger onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar esta consulta?')) onDelete(c.id) }}><Trash2 size={11} /></IconBtn>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`p-1 rounded-md text-gray-500 hover:bg-gray-100 ${danger ? 'hover:text-red-700' : 'hover:text-primary-700'}`}>
      {children}
    </button>
  )
}
