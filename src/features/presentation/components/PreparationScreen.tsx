import { Presentation, CheckSquare, Square, Play, ChevronLeft, FileDown, Loader2 } from 'lucide-react'
import type { Slide } from '../presentationTypes'
import { slideDescriptions, slideIcons } from '../presentationTypes'

// ── Props ────────────────────────────────────────────────────────────────

export interface PreparationScreenProps {
  allSlides: Slide[]
  selectedIndices: Set<number>
  selectedCount: number
  canStart: boolean
  exporting: 'pptx' | null
  toggleSlide: (idx: number) => void
  toggleAll: () => void
  exportToPptx: () => Promise<void>
  onStart: () => void
  onBack: () => void
}

// ── Component ────────────────────────────────────────────────────────────

const typeBadge: Record<Slide['type'], string> = {
  title: 'Portada',
  'map-overview': 'Mapa',
  macroprocess: 'Macro',
  summary: 'Resumen',
  'risk-heatmap': 'Riesgos',
  'kpi-dashboard': 'KPIs',
  'value-analysis': 'Valor',
  'audit-program': 'Auditoria',
  improvements: 'Mejoras',
  coverage: 'Cobertura',
  'org-stats': 'Stats',
  'assets-overview': 'Activos',
  'applications-overview': 'Apps',
}

export function PreparationScreen({
  allSlides,
  selectedIndices,
  selectedCount,
  canStart,
  exporting,
  toggleSlide,
  toggleAll,
  exportToPptx,
  onStart,
  onBack,
}: PreparationScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
      <div className="w-full max-w-2xl rounded-lg border border-gray-100 bg-gray-50 p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Presentation className="w-7 h-7 text-primary-600" />
          <h2 className="text-2xl font-bold text-gray-900">Preparar Presentacion</h2>
        </div>

        {/* Select all / deselect all */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="text-sm text-gray-400">
            {selectedCount} de {allSlides.length} slides seleccionados
          </span>
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition"
          >
            {selectedIndices.size === allSlides.length ? (
              <>
                <CheckSquare className="w-4 h-4" />
                Deseleccionar todo
              </>
            ) : (
              <>
                <Square className="w-4 h-4" />
                Seleccionar todo
              </>
            )}
          </button>
        </div>

        {/* Slide list */}
        <div className="space-y-1 max-h-[28rem] overflow-y-auto pr-1">
          {allSlides.map((s, idx) => {
            const selected = selectedIndices.has(idx)
            const Icon = slideIcons[s.type]

            return (
              <button
                key={idx}
                onClick={() => toggleSlide(idx)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg border transition text-left ${
                  selected
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-100 bg-gray-50 opacity-50'
                } hover:bg-gray-50`}
              >
                {selected ? (
                  <CheckSquare className="w-5 h-5 text-primary-600 shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-600 shrink-0" />
                )}

                <Icon className="w-5 h-5 text-gray-400 shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 truncate">{slideDescriptions[s.type]}</p>
                </div>

                <span className="text-[10px] uppercase tracking-wider text-gray-600 shrink-0">
                  {typeBadge[s.type]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Export loading overlay */}
        {exporting && (
          <div className="fixed inset-0 z-[100] bg-gray-900/45 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white px-10 py-8">
              <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
              <span className="text-lg text-gray-900 font-medium">
                Generando PPTX...
              </span>
              <span className="text-sm text-gray-500">Esto puede tomar unos segundos</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-gray-100">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="flex items-center gap-3">
            <button
              disabled={!canStart || exporting !== null}
              onClick={exportToPptx}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                canStart && !exporting
                  ? 'bg-blue-50 text-blue-600 border border-blue-300 hover:bg-blue-100 hover:text-blue-700'
                  : 'bg-gray-50 text-gray-600 cursor-not-allowed border border-gray-100'
              }`}
            >
              <FileDown className="w-4 h-4" />
              Exportar PPTX
            </button>

            <button
              disabled={!canStart}
              onClick={onStart}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
                canStart
                  ? 'text-gray-900 shadow-lg bg-primary-500 hover:bg-primary-600'
                  : 'bg-gray-50 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" />
              Iniciar Presentacion
            </button>
          </div>
        </div>

        {!canStart && (
          <p className="text-xs text-amber-600 text-center mt-3">
            Selecciona al menos 2 slides para iniciar
          </p>
        )}
      </div>
    </div>
  )
}
