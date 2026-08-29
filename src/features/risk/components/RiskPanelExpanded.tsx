import {
  Plus, AlertTriangle, Sparkles, Loader2, BarChart3,
  CheckSquare, Download, X, ChevronDown,
} from 'lucide-react'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { getRiskLevel, RISK_CATEGORIES } from '@/types/risk'
import { MiniHeatMap } from './MiniHeatMap'
import type { RiskItem } from '@/types/risk'

interface RiskPanelExpandedProps {
  risks: RiskItem[]
  stats: { total: number; critical: number; controls: number }
  selectedCell: { p: number; i: number; type: 'inherent' | 'residual' } | null
  selectedCellRisks: RiskItem[]
  showHeatMap: boolean
  selectionMode: boolean
  selectedIds: Set<string>
  isAnalyzing: boolean
  riskBudgetIsConsuming: boolean
  bpmnXml?: string
  showCategoryDropdown: boolean
  onToggleHeatMap: () => void
  onCellClick: (p: number, i: number, type: 'inherent' | 'residual') => void
  onClearCell: () => void
  onSelectRisk: (id: string) => void
  onToggleSelectionMode: () => void
  onExitSelectionMode: () => void
  onToggleSelect: (id: string) => void
  onAddRisk: () => void
  onAiIdentify: () => void
  onToggleCategoryDropdown: () => void
  onBulkCategory: (category: string) => void
  onBulkDelete: () => void
  onBulkExport: () => void
}

export function RiskPanelExpanded({
  risks, stats, selectedCell, selectedCellRisks,
  showHeatMap, selectionMode, selectedIds,
  isAnalyzing, riskBudgetIsConsuming, bpmnXml,
  showCategoryDropdown,
  onToggleHeatMap, onCellClick, onClearCell, onSelectRisk,
  onToggleSelectionMode, onExitSelectionMode, onToggleSelect,
  onAddRisk, onAiIdentify, onToggleCategoryDropdown,
  onBulkCategory, onBulkDelete, onBulkExport,
}: RiskPanelExpandedProps) {
  const isLoading = isAnalyzing || riskBudgetIsConsuming

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-600" />
          <span className="text-sm font-semibold text-gray-900">Riesgos</span>
          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {risks.length > 0 && (
            <button
              onClick={() => selectionMode ? onExitSelectionMode() : onToggleSelectionMode()}
              className={`p-1.5 rounded-md transition-colors border ${
                selectionMode
                  ? 'text-primary-600 bg-primary-100 border-primary-300'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-200'
              }`}
              title="Seleccionar"
            >
              <CheckSquare size={14} />
            </button>
          )}
          <button
            onClick={onToggleHeatMap}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Mapa de calor"
          >
            <BarChart3 size={14} />
          </button>
          <button
            type="button"
            onClick={onAiIdentify}
            disabled={!bpmnXml || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={!bpmnXml ? 'Necesitas un diagrama BPMN' : 'Identificar riesgos con IA'}
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {isLoading ? 'Generando...' : 'Identificar con IA'}
            <TokenCostBadge operationKey="risks_from_bpmn" />
          </button>
          <button
            onClick={onAddRisk}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Agregar riesgo manual"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Body: heat maps on top, risk list below */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Top section — heat maps side by side */}
        {showHeatMap && (
          <div className="shrink-0 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:divide-x divide-gray-100">
              <div className="p-3 flex flex-col items-center">
                <div className="w-full max-w-[160px]">
                  <MiniHeatMap
                    risks={risks}
                    type="inherent"
                    onCellClick={(p, i) => onCellClick(p, i, 'inherent')}
                    selectedCell={selectedCell?.type === 'inherent' ? selectedCell : null}
                  />
                </div>
              </div>
              <div className="p-3 flex flex-col items-center">
                <div className="w-full max-w-[160px]">
                  <MiniHeatMap
                    risks={risks}
                    type="residual"
                    onCellClick={(p, i) => onCellClick(p, i, 'residual')}
                    selectedCell={selectedCell?.type === 'residual' ? selectedCell : null}
                  />
                </div>
              </div>
            </div>

            {/* Stats bar inline */}
            {stats.total > 0 && (
              <div className="flex items-center gap-6 px-6 py-2 border-t border-gray-100 text-xs">
                <span className="text-gray-500">Total: <strong className="text-gray-900">{stats.total}</strong></span>
                <span className="text-gray-500">Críticos: <strong className="text-red-600">{stats.critical}</strong></span>
                <span className="text-gray-500">Controles: <strong className="text-primary-600">{stats.controls}</strong></span>
              </div>
            )}

            {/* Selected cell detail */}
            {selectedCell && selectedCellRisks.length > 0 && (
              <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                  <span className="text-[10px] text-gray-500">
                    P:{selectedCell.p} / I:{selectedCell.i} · {selectedCellRisks.length} riesgo{selectedCellRisks.length !== 1 ? 's' : ''}
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">
                      {selectedCell.type === 'inherent' ? 'Inherente' : 'Residual'}
                    </span>
                  </span>
                  <button onClick={onClearCell} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={11} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 p-2">
                  {selectedCellRisks.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onSelectRisk(r.id)}
                      className="text-[11px] text-gray-600 hover:text-amber-700 transition-colors px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100"
                    >
                      {r.title || r.riskEvent}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom section — risk list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {risks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <AlertTriangle size={32} className="text-gray-300 mb-4" />
              <p className="text-sm text-gray-400 mb-1">Sin riesgos identificados</p>
              <p className="text-xs text-gray-300">Agrega riesgos manualmente o usa IA para identificarlos desde el diagrama.</p>
            </div>
          ) : (
            risks.map((risk) => {
              const inherent = getRiskLevel(risk.inherentProbability, risk.inherentImpact)
              const residual = getRiskLevel(risk.residualProbability, risk.residualImpact)
              const isSelected = selectedIds.has(risk.id)
              return (
                <div
                  key={risk.id}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                    isSelected ? 'bg-primary-50' : ''
                  }`}
                >
                  {selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleSelect(risk.id) }}
                      className="shrink-0 flex items-center justify-center"
                    >
                      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300 hover:border-primary-500'
                      }`}>
                        {isSelected && (
                          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => !selectionMode && onSelectRisk(risk.id)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className={`w-3 h-3 rounded-full shrink-0 ${inherent.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-amber-700 transition-colors">
                        {risk.title}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {risk.category} · {risk.processStep || 'Sin actividad'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${inherent.color} text-gray-900`}>
                        {risk.inherentProbability}x{risk.inherentImpact}
                      </span>
                      <span className="text-[10px] text-gray-300">&rarr;</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${residual.color} text-gray-900`}>
                        {risk.residualProbability}x{risk.residualImpact}
                      </span>
                    </div>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Bulk action floating toolbar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-2xl">
          <span className="text-xs font-medium text-gray-700 mr-1">
            {selectedIds.size} seleccionados
          </span>
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-medium"
          >
            Eliminar
          </button>
          <div className="relative">
            <button
              onClick={onToggleCategoryDropdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors text-xs font-medium"
            >
              Reclasificar
              <ChevronDown size={11} />
            </button>
            {showCategoryDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-44 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
                {RISK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onBulkCategory(cat)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onBulkExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-xs font-medium"
          >
            <Download size={12} />
            Exportar
          </button>
          <button
            onClick={onExitSelectionMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors text-xs font-medium ml-1"
          >
            <X size={12} />
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
