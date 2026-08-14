import { useState, useCallback } from 'react'
import { Map, Sparkles, Save, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProcesses } from '@/hooks/useProcesses'
import { useCompanyStore } from '@/stores/companyStore'
import { ProcessBand } from './ProcessBand'
import { NewMacroprocessModal } from './NewMacroprocessModal'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Macroprocess } from '@/types'

const CATEGORIES = ['estrategico', 'productivo', 'apoyo'] as const

interface ProcessMapProps {
  onDrillDown: (macroId: string) => void
}

export function ProcessMap({ onDrillDown }: ProcessMapProps) {
  const {
    getMacroByCategory,
    getProcessesByMacro,
    addMacroprocess,
    updateMacroprocess,
    deleteMacroprocess,
    reorderMacroprocesses,
    moveMacroprocessCategory,
    getLevelName,
  } = useProcesses()

  const company = useCompanyStore((s) => s.company)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editMacro, setEditMacro] = useState<Macroprocess | null>(null)
  const [defaultCategory, setDefaultCategory] = useState<'estrategico' | 'productivo' | 'apoyo'>('productivo')

  // Save confirmation state
  const [hasChanges, setHasChanges] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  const handleOrderChanged = useCallback(() => {
    setHasChanges(true)
  }, [])

  const handleSaveOrder = useCallback(() => {
    // Data is already persisted via Zustand persist — this is UX confirmation
    setHasChanges(false)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2000)
  }, [])

  const handleAddForCategory = (cat: 'estrategico' | 'productivo' | 'apoyo') => {
    setEditMacro(null)
    setDefaultCategory(cat)
    setModalOpen(true)
  }

  const handleEdit = (macro: Macroprocess) => {
    setEditMacro(macro)
    setDefaultCategory(macro.category)
    setModalOpen(true)
  }

  const handleSave = (name: string, category: 'estrategico' | 'productivo' | 'apoyo') => {
    if (editMacro) {
      updateMacroprocess(editMacro.id, { name, category })
    } else {
      addMacroprocess(name, category)
    }
  }

  const levelName = getLevelName(2) // level 2 is the child of macro

  const totalMacros =
    getMacroByCategory('estrategico').length +
    getMacroByCategory('productivo').length +
    getMacroByCategory('apoyo').length
  const isEmpty = totalMacros === 0

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Map}
        title="Mapa de Procesos"
        subtitle={company?.name ?? undefined}
        actions={
          <Link
            to="/app/process-map/onboarding"
            className="whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-medium shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Sparkles size={14} />
            Construir con IA
          </Link>
        }
      />

      {/* Empty state CTA */}
      {isEmpty && (
        <Link
          to="/app/process-map/onboarding"
          className="block rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent p-6 hover:border-cyan-400/50 hover:from-cyan-500/15 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/20 ring-1 ring-cyan-500/30 group-hover:scale-105 transition-transform">
              <Sparkles size={22} className="text-cyan-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">
                Arma tu mapa conversando con la IA
              </h3>
              <p className="text-sm text-white/50 mt-0.5">
                Un consultor tipo Jarvis que construye tus macroprocesos en vivo mientras hablas con el.
              </p>
            </div>
            <div className="text-cyan-300 text-xs font-medium group-hover:translate-x-1 transition-transform">
              Empezar →
            </div>
          </div>
        </Link>
      )}

      {/* Three bands */}
      <div className="space-y-4">
        {CATEGORIES.map((cat) => (
          <ProcessBand
            key={cat}
            category={cat}
            macroprocesses={getMacroByCategory(cat)}
            getChildCount={(macroId) => getProcessesByMacro(macroId).length}
            levelName={levelName}
            onAddMacro={() => handleAddForCategory(cat)}
            onDrillDown={onDrillDown}
            onEditMacro={handleEdit}
            onDeleteMacro={deleteMacroprocess}
            onReorder={reorderMacroprocesses}
            onMoveCategory={moveMacroprocessCategory}
            onOrderChanged={handleOrderChanged}
          />
        ))}
      </div>

      {/* Floating "Guardar orden" button */}
      <div
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 transition-all duration-300 ${
          hasChanges || showSaved
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={handleSaveOrder}
          disabled={showSaved}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-xl transition-all duration-200 ${
            showSaved
              ? 'bg-green-600 shadow-green-500/30'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105'
          }`}
        >
          {showSaved ? (
            <>
              <Check size={16} />
              Guardado!
            </>
          ) : (
            <>
              <Save size={16} />
              Guardar orden
            </>
          )}
        </button>
      </div>

      {/* Modal */}
      <NewMacroprocessModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditMacro(null)
        }}
        onSave={handleSave}
        editMacro={editMacro}
        defaultCategory={defaultCategory}
      />
    </div>
  )
}
