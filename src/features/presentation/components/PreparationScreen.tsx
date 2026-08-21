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
      <div className="w-full max-w-2xl rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Presentation className="w-7 h-7 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Preparar Presentacion</h2>
        </div>

        {/* Select all / deselect all */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="text-sm text-gray-400">
            {selectedCount} de {allSlides.length} slides seleccionados
          </span>
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition"
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
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition text-left ${
                  selected
                    ? 'border-cyan-500/30 bg-cyan-500/[0.06]'
                    : 'border-white/5 bg-white/[0.02] opacity-50'
                } hover:bg-white/[0.06]`}
              >
                {selected ? (
                  <CheckSquare className="w-5 h-5 text-cyan-400 shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-600 shrink-0" />
                )}

                <Icon className="w-5 h-5 text-gray-400 shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.title}</p>
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
          <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#0d1117] px-10 py-8">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <span className="text-lg text-white font-medium">
                Generando PPTX...
              </span>
              <span className="text-sm text-gray-500">Esto puede tomar unos segundos</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-white/5">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="flex items-center gap-3">
            <button
              disabled={!canStart || exporting !== null}
              onClick={exportToPptx}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                canStart && !exporting
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 hover:text-blue-300'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'
              }`}
            >
              <FileDown className="w-4 h-4" />
              Exportar PPTX
            </button>

            <button
              disabled={!canStart}
              onClick={onStart}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition ${
                canStart
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-gray-900 hover:from-cyan-400 hover:to-cyan-300 shadow-lg shadow-cyan-500/20'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" />
              Iniciar Presentacion
            </button>
          </div>
        </div>

        {!canStart && (
          <p className="text-xs text-amber-400/70 text-center mt-3">
            Selecciona al menos 2 slides para iniciar
          </p>
        )}
      </div>
    </div>
  )
}
