import { useState, useCallback, useRef, useMemo } from 'react'
import { Map, Sparkles, Save, Check, ClipboardList, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProcesses } from '@/hooks/useProcesses'
import { useCompanyStore } from '@/stores/companyStore'
import { useAuthStore } from '@/stores/authStore'
import { ProcessBand } from './ProcessBand'
import { NewMacroprocessModal } from './NewMacroprocessModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { InventoryWizard } from '@/features/inventory/components/InventoryWizard'
import { useInventoryData } from '@/features/inventory/useInventoryData'
import { useInventoryReportRows } from '@/features/inventory/inventoryReportData'
import { MapExportModal } from './MapExportModal'
import type { MapData } from '@/utils/mapSvg'
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
  const profile = useAuthStore((s) => s.profile)

  // Exportación del mapa: pantalla propia (SVG vectorial + marca guardada)
  const mapRef = useRef<HTMLDivElement>(null)
  const { companyId, appMacros, doc } = useInventoryData()
  const invMacros = doc?.macros?.length ? doc.macros : appMacros
  const invRows = useInventoryReportRows(companyId, invMacros)
  const [exportOpen, setExportOpen] = useState(false)
  const mapData = useMemo<MapData>(() => {
    const names = (cat: 'estrategico' | 'productivo' | 'apoyo') => getMacroByCategory(cat).map((m) => m.name)
    return { org: company?.name ?? 'Organización', E: names('estrategico'), P: names('productivo'), A: names('apoyo') }
  }, [getMacroByCategory, company])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editMacro, setEditMacro] = useState<Macroprocess | null>(null)
  const [defaultCategory, setDefaultCategory] = useState<'estrategico' | 'productivo' | 'apoyo'>('productivo')

  // Save confirmation state
  const [hasChanges, setHasChanges] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // Asistente de Inventario de Procesos (lee mapa + áreas de la app)
  const [inventoryOpen, setInventoryOpen] = useState(false)

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
          <div className="flex items-center gap-2">
            {/* Exportar mapa: pantalla propia con marca (PNG/SVG/PDF), config guardada */}
            <button
              onClick={() => setExportOpen(true)}
              disabled={isEmpty}
              title={isEmpty ? 'Crea primero tus macroprocesos' : 'Exportar el mapa'}
              className="whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              Exportar
            </button>
            <button
              onClick={() => setInventoryOpen(true)}
              disabled={isEmpty}
              title={isEmpty ? 'Crea primero tus macroprocesos' : 'Levantar el inventario de procesos con IA'}
              className="whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-lg border border-primary-300 bg-primary-50 hover:bg-primary-50 text-primary-700 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ClipboardList size={14} />
              Inventario de Procesos IA
            </button>
            <Link
              to="/app/process-map/onboarding"
              className="whitespace-nowrap flex items-center gap-2 px-3.5 py-2 rounded-lg text-white text-sm font-medium shadow-lg transition-all bg-primary-500 hover:bg-primary-600"
            >
              <Sparkles size={14} />
              Construir con IA
            </Link>
          </div>
        }
      />

      {/* Empty state CTA */}
      {isEmpty && (
        <Link
          to="/app/process-map/onboarding"
          className="block rounded-lg border border-primary-300 p-6 hover:border-primary-300 transition-all group bg-primary-500 hover:bg-primary-600"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary-100 ring-1 ring-primary-500 group-hover:scale-105 transition-transform">
              <Sparkles size={22} className="text-primary-700" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900">
                Arma tu mapa conversando con la IA
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Un consultor tipo Jarvis que construye tus macroprocesos en vivo mientras hablas con el.
              </p>
            </div>
            <div className="text-primary-700 text-xs font-medium group-hover:translate-x-1 transition-transform">
              Empezar →
            </div>
          </div>
        </Link>
      )}

      {/* Three bands */}
      <div ref={mapRef} className="space-y-4">
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
          className={`flex items-center gap-2 px-5 py-3 rounded-lg text-white text-sm font-semibold shadow-xl transition-all duration-200 ${
            showSaved
              ? 'bg-emerald-600'
              : 'hover:scale-105 bg-primary-500 hover:bg-primary-600'
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

      {inventoryOpen && <InventoryWizard onClose={() => setInventoryOpen(false)} />}

      {exportOpen && (
        <MapExportModal
          data={mapData}
          invRows={invRows}
          author={profile?.full_name ?? ''}
          country={company?.country ?? ''}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  )
}
