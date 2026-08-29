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
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { BookOpen, Plus, Trash2, Pencil, Check, X, EyeOff, Eye, MonitorSmartphone } from 'lucide-react'
import { useCatalogStore, MANAGED_CATALOGS, type CatalogItem } from '@/features/catalog/catalogStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { ApplicationsCatalog } from '@/features/applications/components/ApplicationsCatalog'

// Entrada especial: inventario de aplicaciones (no es un combo simple).
const APPS_TYPE = '__applications__'
const APPS_META = { type: APPS_TYPE, label: 'Aplicaciones (inventario)', description: 'Inventario central de las aplicaciones/software de la empresa. El área de TI completa aquí la ficha (proveedor, despliegue, API, criticidad…) y todos los usuarios la ven actualizada.' }

export default function CatalogsPage() {
  const catalogItems = useCatalogStore((s) => s.catalogItems)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const updateCatalogItem = useCatalogStore((s) => s.updateCatalogItem)
  const deleteCatalogItem = useCatalogStore((s) => s.deleteCatalogItem)

  // La pestaña inicial puede venir del superbuscador vía ?tab= (deep-link).
  const [searchParams, setSearchParams] = useSearchParams()
  const paramTab = searchParams.get('tab')
  const validTab = paramTab === APPS_TYPE || MANAGED_CATALOGS.some((c) => c.type === paramTab)
  const [activeType, setActiveTypeRaw] = useState<string>(validTab ? paramTab! : MANAGED_CATALOGS[0].type)
  const setActiveType = (t: string) => { setActiveTypeRaw(t); setSearchParams((prev) => { prev.set('tab', t); return prev }, { replace: true }) }
  const activeMeta = activeType === APPS_TYPE ? APPS_META : MANAGED_CATALOGS.find((c) => c.type === activeType)!

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
        iconClass="bg-primary-50 border border-primary-200"
        title="Catalogo General"
        subtitle="Administra las opciones de los combos que aparecen en la caracterizacion de procesos."
      />

      {/* Layout: tabs left + editor right */}
      <div className="grid grid-cols-12 gap-4">
        {/* ─── Tabs lateral ──────────────────────────────────────── */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <nav className="space-y-1">
            {/* Inventario de aplicaciones (destacado) */}
            <button
              onClick={() => setActiveType(APPS_TYPE)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${activeType === APPS_TYPE ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2">
                <MonitorSmartphone size={14} className="shrink-0" />
                <span className="text-sm font-medium truncate">Aplicaciones (inventario)</span>
              </div>
            </button>
            {MANAGED_CATALOGS.map((cat) => {
              const count = catalogItems.filter((c) => c.catalog_type === cat.type && c.is_active).length
              const isActive = activeType === cat.type
              return (
                <button
                  key={cat.type}
                  onClick={() => setActiveType(cat.type)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${
                    isActive
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-500'}`}>
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
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{activeMeta.label}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{activeMeta.description}</p>
              </div>
            </div>

            {activeType === APPS_TYPE ? (
              <ApplicationsCatalog />
            ) : (
              <CatalogEditor
                type={activeType}
                items={items}
                onAdd={(value) => addCatalogItem(activeType, value)}
                onUpdate={updateCatalogItem}
                onDelete={deleteCatalogItem}
              />
            )}
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
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          onClick={handleAdd}
          disabled={!newValue.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-primary-500 hover:bg-primary-600"
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-gray-100 divide-y divide-gray-100">
        {items.length === 0 && (
          <div className="px-4 py-10 text-center text-xs text-gray-400">
            No hay opciones en este catalogo. Agrega la primera arriba.
          </div>
        )}
        {items.map((item) => {
          const isEditing = editingId === item.id
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                item.is_active ? 'hover:bg-gray-50' : 'opacity-50 hover:bg-gray-50'
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
                  className="flex-1 px-2 py-1 border border-primary-300 rounded-md text-sm bg-gray-50 text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              ) : (
                <span className={`flex-1 text-sm ${item.is_active ? 'text-gray-800' : 'text-gray-500 line-through'}`}>
                  {item.value}
                </span>
              )}

              <div className="flex items-center gap-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={commitEdit}
                      className="p-2.5 rounded-md text-emerald-600 hover:bg-emerald-50"
                      title="Confirmar"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2.5 rounded-md text-gray-500 hover:bg-gray-50"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                      title="Renombrar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onUpdate(item.id, { is_active: !item.is_active })}
                      className="p-2.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                      title={item.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {item.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(item.id)}
                      className="p-2.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
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

      <p className="text-[11px] text-gray-400">
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
