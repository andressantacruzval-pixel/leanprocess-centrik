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
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Riesgos</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {risks.length > 0 && (
            <button
              onClick={() => selectionMode ? onExitSelectionMode() : onToggleSelectionMode()}
              className={`p-1.5 rounded-md transition-colors border ${
                selectionMode
                  ? 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/10 border-white/10'
              }`}
              title="Seleccionar"
            >
              <CheckSquare size={14} />
            </button>
          )}
          <button
            onClick={onToggleHeatMap}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/10 transition-colors"
            title="Mapa de calor"
          >
            <BarChart3 size={14} />
          </button>
          <button
            type="button"
            onClick={onAiIdentify}
            disabled={!bpmnXml || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={!bpmnXml ? 'Necesitas un diagrama BPMN' : 'Identificar riesgos con IA'}
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {isLoading ? 'Generando...' : 'Identificar con IA'}
            <TokenCostBadge operationKey="risks_from_bpmn" />
          </button>
          <button
            onClick={onAddRisk}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/10 transition-colors"
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
          <div className="shrink-0 border-b border-white/5 bg-white/[0.015]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:divide-x divide-white/5">
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
              <div className="flex items-center gap-6 px-6 py-2 border-t border-white/5 text-xs">
                <span className="text-white/40">Total: <strong className="text-white">{stats.total}</strong></span>
                <span className="text-white/40">Críticos: <strong className="text-red-400">{stats.critical}</strong></span>
                <span className="text-white/40">Controles: <strong className="text-cyan-400">{stats.controls}</strong></span>
              </div>
            )}

            {/* Selected cell detail */}
            {selectedCell && selectedCellRisks.length > 0 && (
              <div className="mx-4 mb-3 rounded-lg border border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                  <span className="text-[10px] text-white/50">
                    P:{selectedCell.p} / I:{selectedCell.i} · {selectedCellRisks.length} riesgo{selectedCellRisks.length !== 1 ? 's' : ''}
                    <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/30">
                      {selectedCell.type === 'inherent' ? 'Inherente' : 'Residual'}
                    </span>
                  </span>
                  <button onClick={onClearCell} className="text-white/25 hover:text-white/55 transition-colors">
                    <X size={11} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 p-2">
                  {selectedCellRisks.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onSelectRisk(r.id)}
                      className="text-[11px] text-white/60 hover:text-amber-300 transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
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
              <AlertTriangle size={32} className="text-white/10 mb-4" />
              <p className="text-sm text-white/30 mb-1">Sin riesgos identificados</p>
              <p className="text-xs text-white/20">Agrega riesgos manualmente o usa IA para identificarlos desde el diagrama.</p>
            </div>
          ) : (
            risks.map((risk) => {
              const inherent = getRiskLevel(risk.inherentProbability, risk.inherentImpact)
              const residual = getRiskLevel(risk.residualProbability, risk.residualImpact)
              const isSelected = selectedIds.has(risk.id)
              return (
                <div
                  key={risk.id}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left border-b border-white/5 hover:bg-white/[0.03] transition-colors group ${
                    isSelected ? 'bg-cyan-500/[0.06]' : ''
                  }`}
                >
                  {selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleSelect(risk.id) }}
                      className="shrink-0 flex items-center justify-center"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-cyan-500 border-cyan-500' : 'border-white/20 hover:border-cyan-400'
                      }`}>
                        {isSelected && (
                          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
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
                      <p className="text-sm font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                        {risk.title}
                      </p>
                      <p className="text-xs text-white/30 truncate mt-0.5">
                        {risk.category} · {risk.processStep || 'Sin actividad'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inherent.color} text-white`}>
                        {risk.inherentProbability}x{risk.inherentImpact}
                      </span>
                      <span className="text-[10px] text-white/15">&rarr;</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${residual.color} text-white`}>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#0c1322]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
          <span className="text-xs font-medium text-white/70 mr-1">
            {selectedIds.size} seleccionados
          </span>
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors text-xs font-medium"
          >
            Eliminar
          </button>
          <div className="relative">
            <button
              onClick={onToggleCategoryDropdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors text-xs font-medium"
            >
              Reclasificar
              <ChevronDown size={11} />
            </button>
            {showCategoryDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-44 bg-[#0f1629] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                {RISK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => onBulkCategory(cat)}
                    className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] hover:text-amber-300 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onBulkExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-medium"
          >
            <Download size={12} />
            Exportar
          </button>
          <button
            onClick={onExitSelectionMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors text-xs font-medium ml-1"
          >
            <X size={12} />
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
