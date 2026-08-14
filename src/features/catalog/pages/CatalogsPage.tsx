/**
 * CatalogsPage — Catalogo General
 * --------------------------------
 * Administracion central de los combos parametricos que aparecen
 * en la Caracterizacion del Proceso (frecuencia, nivel ejecucion,
 * tipo proceso, linea de negocio, medio entrega, tipo ejecucion,
 * supervision). Cada catalogo es una lista CRUD que el usuario puede
 * editar sin tocar codigo, evitando que cada empresa tenga que vivir
 * con los seeds por defecto.
 */

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { BookOpen, Plus, Trash2, Pencil, Check, X, EyeOff, Eye } from 'lucide-react'
import { useCatalogStore, MANAGED_CATALOGS, type CatalogItem } from '@/features/catalog/catalogStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export default function CatalogsPage() {
  const catalogItems = useCatalogStore((s) => s.catalogItems)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const updateCatalogItem = useCatalogStore((s) => s.updateCatalogItem)
  const deleteCatalogItem = useCatalogStore((s) => s.deleteCatalogItem)

  const [activeType, setActiveType] = useState<string>(MANAGED_CATALOGS[0].type)
  const activeMeta = MANAGED_CATALOGS.find((c) => c.type === activeType)!

  const items = useMemo(
    () =>
      catalogItems
        .filter((c) => c.catalog_type === activeType)
        .sort((a, b) => a.sort_order - b.sort_order),
    [catalogItems, activeType]
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={BookOpen}
        iconClass="bg-cyan-500/10 border border-cyan-500/20"
        title="Catalogo General"
        subtitle="Administra las opciones de los combos que aparecen en la caracterizacion de procesos."
      />

      {/* Layout: tabs left + editor right */}
      <div className="grid grid-cols-12 gap-4">
        {/* ─── Tabs lateral ──────────────────────────────────────── */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <nav className="space-y-1">
            {MANAGED_CATALOGS.map((cat) => {
              const count = catalogItems.filter((c) => c.catalog_type === cat.type && c.is_active).length
              const isActive = activeType === cat.type
              return (
                <button
                  key={cat.type}
                  onClick={() => setActiveType(cat.type)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border ${
                    isActive
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : 'border-transparent text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-white/40'}`}>
                      {count}
                    </span>
                  </div>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ─── Editor del catalogo activo ────────────────────────── */}
        <section className="col-span-12 md:col-span-8 lg:col-span-9">
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-white">{activeMeta.label}</h2>
                <p className="text-xs text-white/40 mt-0.5">{activeMeta.description}</p>
              </div>
            </div>

            <CatalogEditor
              type={activeType}
              items={items}
              onAdd={(value) => addCatalogItem(activeType, value)}
              onUpdate={updateCatalogItem}
              onDelete={deleteCatalogItem}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Editor con CRUD inline ────────────────────────────────────────────

interface CatalogEditorProps {
  type: string
  items: CatalogItem[]
  onAdd: (value: string) => void
  onUpdate: (id: string, updates: Partial<CatalogItem>) => void
  onDelete: (id: string) => void
}

function CatalogEditor({ items, onAdd, onUpdate, onDelete }: CatalogEditorProps) {
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleAdd = () => {
    const trimmed = newValue.trim()
    if (!trimmed) return
    if (items.some((i) => i.value.toLowerCase() === trimmed.toLowerCase())) return
    onAdd(trimmed)
    setNewValue('')
  }

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id)
    setEditValue(item.value)
  }

  const commitEdit = () => {
    if (!editingId) return
    const trimmed = editValue.trim()
    if (trimmed) {
      onUpdate(editingId, { value: trimmed })
    }
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          placeholder="Nueva opcion..."
          className="flex-1 px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
        <button
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>

      {/* List */}
      <div className="rounded-xl border border-white/5 divide-y divide-white/5">
        {items.length === 0 && (
          <div className="px-4 py-10 text-center text-xs text-white/30">
            No hay opciones en este catalogo. Agrega la primera arriba.
          </div>
        )}
        {items.map((item) => {
          const isEditing = editingId === item.id
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                item.is_active ? 'hover:bg-white/[0.02]' : 'opacity-50 hover:bg-white/[0.02]'
              }`}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 px-2 py-1 border border-cyan-500/40 rounded text-sm bg-white/5 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              ) : (
                <span className={`flex-1 text-sm ${item.is_active ? 'text-white/80' : 'text-white/40 line-through'}`}>
                  {item.value}
                </span>
              )}

              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={commitEdit}
                      className="p-2.5 rounded text-emerald-400 hover:bg-emerald-500/10"
                      title="Confirmar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2.5 rounded text-white/40 hover:bg-white/5"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2.5 rounded text-white/30 hover:text-cyan-400 hover:bg-cyan-500/10"
                      title="Renombrar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onUpdate(item.id, { is_active: !item.is_active })}
                      className="p-2.5 rounded text-white/30 hover:text-amber-400 hover:bg-amber-500/10"
                      title={item.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {item.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item.id)}
                      className="p-2.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-white/30">
        Tip: desactivar oculta la opcion en los combos sin perderla. Eliminar la borra definitivamente.
      </p>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="¿Eliminar este elemento del catalogo?"
        onConfirm={() => {
          if (deleteTarget) { onDelete(deleteTarget); setDeleteTarget(null) }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
