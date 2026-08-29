import { useState, useCallback, useMemo } from 'react'
import {
  Plus, AlertTriangle, Sparkles, Loader2, BarChart3,
  CheckSquare, Trash2, Download, X, ChevronDown,
} from 'lucide-react'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { useRiskStore } from '@/stores/riskStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useProcessStore } from '@/stores/processStore'
import { exportRisksToExcel } from '@/utils/riskExcelExporter'
import { getRiskLevel, RISK_CATEGORIES } from '@/types/risk'
import { MiniHeatMap } from './MiniHeatMap'
import { RiskDetailModal } from './RiskDetailModal'
import { RiskPanelExpanded } from './RiskPanelExpanded'
import { identifyRisksFromBpmn } from '@/lib/riskAi'
import { useRiskAiSuggest } from '../hooks/useRiskAiSuggest'

interface RiskPanelProps {
  processId: string
  processName: string
  bpmnXml?: string
  isExpanded?: boolean
}

export function RiskPanel({ processId, processName, bpmnXml, isExpanded }: RiskPanelProps) {
  const allRisks = useRiskStore((s) => s.risks)
  const risks = useMemo(() => allRisks.filter((r) => r.process_id === processId), [allRisks, processId])
  const addRisk = useRiskStore((s) => s.addRisk)
  const updateRisk = useRiskStore((s) => s.updateRisk)
  const deleteRisk = useRiskStore((s) => s.deleteRisk)
  const addControl = useRiskStore((s) => s.addControl)
  const updateControl = useRiskStore((s) => s.updateControl)
  const deleteControl = useRiskStore((s) => s.deleteControl)
  const importAiRisks = useRiskStore((s) => s.importAiRisks)
  const bulkDeleteRisks = useRiskStore((s) => s.bulkDeleteRisks)
  const bulkUpdateCategory = useRiskStore((s) => s.bulkUpdateCategory)

  const company = useCompanyStore((s) => s.company)
  const processes = useProcessStore((s) => s.processes)

  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null)
  const [deleteRiskTarget, setDeleteRiskTarget] = useState<string | null>(null)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [showHeatMap, setShowHeatMap] = useState(true)
  const [selectedCell, setSelectedCell] = useState<{
    p: number; i: number; type: 'inherent' | 'residual'
  } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const riskBudget = useTokenBudget({ operationKey: 'risks_from_bpmn' })

  // ── Selection mode ──────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setShowCategoryDropdown(false)
  }, [])

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return
    setShowBulkConfirm(true)
  }, [selectedIds])

  const handleBulkCategory = useCallback((category: string) => {
    if (selectedIds.size === 0) return
    bulkUpdateCategory(Array.from(selectedIds), category)
    setShowCategoryDropdown(false)
  }, [selectedIds, bulkUpdateCategory])

  const handleCellClick = useCallback((p: number, i: number, type: 'inherent' | 'residual') => {
    setSelectedCell(prev =>
      prev?.p === p && prev?.i === i && prev?.type === type ? null : { p, i, type }
    )
  }, [])

  const handleBulkExport = useCallback(async () => {
    if (selectedIds.size === 0) return
    const selected = risks.filter((r) => selectedIds.has(r.id))
    const proc = processes.find((p) => p.id === processId)
    await exportRisksToExcel(
      selected,
      processName,
      proc?.management,
      proc?.coordination,
      company?.name,
    )
  }, [selectedIds, risks, processes, processId, processName, company?.name])

  const selectedRisk = useMemo(() => risks.find((r) => r.id === selectedRiskId) ?? null, [risks, selectedRiskId])

  const selectedCellRisks = useMemo(() => {
    if (!selectedCell) return []
    return risks.filter((r) => {
      const prob = selectedCell.type === 'inherent' ? r.inherentProbability : r.residualProbability
      const imp  = selectedCell.type === 'inherent' ? r.inherentImpact      : r.residualImpact
      return prob === selectedCell.p && imp === selectedCell.i
    })
  }, [risks, selectedCell])

  // ── AI Identification ──────────────────────────────────────────────

  const handleAiIdentify = useCallback(async () => {
    if (!bpmnXml || isAnalyzing) return
    setIsAnalyzing(true)
    await riskBudget.run(async () => {
      const results = await identifyRisksFromBpmn(bpmnXml, processName, company?.name)
      if (results.length > 0) {
        // Eliminar riesgos existentes del proceso antes de importar los nuevos
        const existingIds = risks.map((r) => r.id)
        if (existingIds.length > 0) bulkDeleteRisks(existingIds)
        const items = results.map((r) => ({
          processStep: r.processStep,
          title: r.title,
          description: r.description,
          category: r.category,
          inherentProbability: r.inherentProbability,
          inherentImpact: r.inherentImpact,
          controls: r.extractedControls.map((ctrl) => ({
            id: crypto.randomUUID(),
            description: ctrl.description,
            bpmnElementId: ctrl.bpmnElementId,
            type: 3 as const, nature: 1 as const, doc: 3 as const, freq: 3 as const,
            evidence: 1 as const, segregation: 1 as const, training: 1 as const, monitoring: 1 as const,
            mitigates: 'Ambos' as const,
            score: 0,
            effectiveness: 'Deficiente' as const,
          })),
        }))
        importAiRisks(processId, items)
      }
    })
    setIsAnalyzing(false)
  }, [bpmnXml, processName, company?.name, processId, isAnalyzing, importAiRisks, bulkDeleteRisks, risks, riskBudget])

  // ── AI Suggest One ────────────────────────────────────────────────
  const { handleAiSuggestOne, isAiSuggesting } = useRiskAiSuggest({
    bpmnXml,
    processName,
    companyName: company?.name,
    selectedRiskId,
    risks,
    riskBudget,
    updateRisk,
    addControl,
  })

  // ── Stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const critical = risks.filter((r) => r.inherentProbability * r.inherentImpact >= 15).length
    const controlCount = risks.reduce((sum, r) => sum + r.controls.length, 0)
    return { total: risks.length, critical, controls: controlCount }
  }, [risks])

  if (isExpanded) {
    return (
      <>
        <RiskPanelExpanded
          risks={risks}
          stats={stats}
          selectedCell={selectedCell}
          selectedCellRisks={selectedCellRisks}
          showHeatMap={showHeatMap}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          isAnalyzing={isAnalyzing}
          riskBudgetIsConsuming={riskBudget.isConsuming}
          bpmnXml={bpmnXml}
          showCategoryDropdown={showCategoryDropdown}
          onToggleHeatMap={() => setShowHeatMap(!showHeatMap)}
          onCellClick={handleCellClick}
          onClearCell={() => setSelectedCell(null)}
          onSelectRisk={setSelectedRiskId}
          onToggleSelectionMode={() => setSelectionMode(true)}
          onExitSelectionMode={exitSelectionMode}
          onToggleSelect={toggleSelection}
          onAddRisk={() => { const r = addRisk(processId); setSelectedRiskId(r.id) }}
          onAiIdentify={handleAiIdentify}
          onToggleCategoryDropdown={() => setShowCategoryDropdown(!showCategoryDropdown)}
          onBulkCategory={handleBulkCategory}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
        />
        {selectedRisk && (
          <RiskDetailModal
            risk={selectedRisk}
            onUpdate={(updates) => updateRisk(selectedRisk.id, updates)}
            onDelete={() => setDeleteRiskTarget(selectedRisk.id)}
            onAddControl={() => addControl(selectedRisk.id)}
            onUpdateControl={(cId, u) => updateControl(selectedRisk.id, cId, u)}
            onDeleteControl={(cId) => deleteControl(selectedRisk.id, cId)}
            onClose={() => setSelectedRiskId(null)}
            onAiSuggest={handleAiSuggestOne}
            isAiSuggesting={isAiSuggesting}
            canAiSuggest={!!bpmnXml}
          />
        )}
        <ConfirmDeleteModal
          open={deleteRiskTarget !== null}
          title="¿Eliminar este riesgo?"
          onConfirm={() => {
            if (deleteRiskTarget) {
              deleteRisk(deleteRiskTarget)
              setSelectedRiskId(null)
              setDeleteRiskTarget(null)
            }
          }}
          onCancel={() => setDeleteRiskTarget(null)}
        />
        <ConfirmDeleteModal
          open={showBulkConfirm}
          title={`¿Eliminar ${selectedIds.size} riesgo${selectedIds.size === 1 ? '' : 's'}?`}
          onConfirm={() => { bulkDeleteRisks(Array.from(selectedIds)); exitSelectionMode(); setShowBulkConfirm(false) }}
          onCancel={() => setShowBulkConfirm(false)}
        />
        <InsufficientTokensModal
          open={riskBudget.showInsufficientModal}
          onClose={riskBudget.closeInsufficientModal}
          operationKey="risks_from_bpmn"
        />
      </>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600" />
          <span className="text-xs font-semibold text-gray-900">Riesgos</span>
          <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Selection toggle */}
          {risks.length > 0 && (
            <button
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
              className={`p-1.5 rounded-md transition-colors border ${
                selectionMode
                  ? 'text-primary-600 bg-primary-100 border-primary-300'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-200'
              }`}
              title="Seleccionar"
            >
              <CheckSquare size={13} />
            </button>
          )}
          <button
            onClick={() => setShowHeatMap(!showHeatMap)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Mapa de calor"
          >
            <BarChart3 size={13} />
          </button>
          <button
            type="button"
            onClick={handleAiIdentify}
            disabled={!bpmnXml || isAnalyzing || riskBudget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={!bpmnXml ? 'Necesitas un diagrama BPMN' : 'Identificar riesgos con IA'}
          >
            {(isAnalyzing || riskBudget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {(isAnalyzing || riskBudget.isConsuming) ? 'Generando...' : 'Identificar con IA'}
            <TokenCostBadge operationKey="risks_from_bpmn" />
          </button>
          <button
            onClick={() => {
              const newRisk = addRisk(processId)
              setSelectedRiskId(newRisk.id)
            }}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
            title="Agregar riesgo manual"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Mini heat map toggle */}
      {showHeatMap && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <MiniHeatMap
              risks={risks}
              type="inherent"
              onCellClick={(p, i) => handleCellClick(p, i, 'inherent')}
              selectedCell={selectedCell?.type === 'inherent' ? selectedCell : null}
            />
            <MiniHeatMap
              risks={risks}
              type="residual"
              onCellClick={(p, i) => handleCellClick(p, i, 'residual')}
              selectedCell={selectedCell?.type === 'residual' ? selectedCell : null}
            />
          </div>
          {selectedCell && selectedCellRisks.length > 0 && (
            <div className="mt-2 rounded-md border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] text-gray-500">
                  P:{selectedCell.p} / I:{selectedCell.i} · {selectedCellRisks.length} riesgo{selectedCellRisks.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-400">
                    {selectedCell.type === 'inherent' ? 'Inherente' : 'Residual'}
                  </span>
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
              <div>
                {selectedCellRisks.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRiskId(r.id)}
                    className="w-full text-left px-3 py-2 text-[11px] text-gray-600 hover:bg-gray-50 hover:text-amber-700 transition-colors border-b border-gray-100 last:border-0 truncate"
                  >
                    {r.title || r.riskEvent}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats bar */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 text-[9px] text-gray-500">
          <span>Criticos: <strong className="text-red-600">{stats.critical}</strong></span>
          <span>Controles: <strong className="text-primary-600">{stats.controls}</strong></span>
          {selectionMode && (
            <span className="ml-auto text-primary-600">{selectedIds.size} seleccionados</span>
          )}
        </div>
      )}

      {/* Risk list — simplified cards */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {risks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertTriangle size={24} className="text-gray-300 mb-3" />
            <p className="text-xs text-gray-400 mb-1">Sin riesgos identificados</p>
            <p className="text-[10px] text-gray-300 mb-4">Agrega riesgos manualmente o usa IA para identificarlos desde el diagrama.</p>
          </div>
        ) : (
          risks.map((risk) => {
            const inherent = getRiskLevel(risk.inherentProbability, risk.inherentImpact)
            const residual = getRiskLevel(risk.residualProbability, risk.residualImpact)
            const isSelected = selectedIds.has(risk.id)
            return (
              <div
                key={risk.id}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                  isSelected ? 'bg-primary-50' : ''
                }`}
              >
                {/* Checkbox in selection mode */}
                {selectionMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelection(risk.id) }}
                    className="shrink-0 flex items-center justify-center"
                  >
                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-gray-300 hover:border-primary-500'
                    }`}>
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-gray-900" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                  </button>
                )}

                {/* Clickable card area */}
                <button
                  onClick={() => !selectionMode && setSelectedRiskId(risk.id)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  {/* Level dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${inherent.color}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-gray-900 truncate group-hover:text-amber-700 transition-colors">
                      {risk.title}
                    </p>
                    <p className="text-[9px] text-gray-400 truncate mt-0.5">
                      {risk.category} · {risk.processStep || 'Sin actividad'}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${inherent.color} text-gray-900`}>
                      {risk.inherentProbability}x{risk.inherentImpact}
                    </span>
                    <span className="text-[8px] text-gray-300">&rarr;</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${residual.color} text-gray-900`}>
                      {risk.residualProbability}x{risk.residualImpact}
                    </span>
                  </div>
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* ── Bulk action floating toolbar ────────────────────────────────── */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-2xl">
          <span className="text-xs font-medium text-gray-700 mr-1">
            {selectedIds.size} seleccionados
          </span>

          {/* Delete */}
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-[11px] font-medium"
          >
            <Trash2 size={12} />
            Eliminar
          </button>

          {/* Reclassify dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors text-[11px] font-medium"
            >
              Reclasificar
              <ChevronDown size={11} />
            </button>
            {showCategoryDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-44 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
                {RISK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleBulkCategory(cat)}
                    className="w-full text-left px-3 py-2 text-[11px] text-gray-700 hover:bg-gray-50 hover:text-amber-700 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-[11px] font-medium"
          >
            <Download size={12} />
            Exportar
          </button>

          {/* Cancel */}
          <button
            onClick={exitSelectionMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600 transition-colors text-[11px] font-medium ml-1"
          >
            <X size={12} />
            Cancelar
          </button>
        </div>
      )}

      {/* Risk Detail Modal */}
      {selectedRisk && (
        <RiskDetailModal
          risk={selectedRisk}
          onUpdate={(updates) => updateRisk(selectedRisk.id, updates)}
          onDelete={() => setDeleteRiskTarget(selectedRisk.id)}
          onAddControl={() => addControl(selectedRisk.id)}
          onUpdateControl={(cId, u) => updateControl(selectedRisk.id, cId, u)}
          onDeleteControl={(cId) => deleteControl(selectedRisk.id, cId)}
          onClose={() => setSelectedRiskId(null)}
          onAiSuggest={handleAiSuggestOne}
          isAiSuggesting={isAiSuggesting}
          canAiSuggest={!!bpmnXml}
        />
      )}

      <ConfirmDeleteModal
        open={deleteRiskTarget !== null}
        title="¿Eliminar este riesgo?"
        onConfirm={() => {
          if (deleteRiskTarget) {
            deleteRisk(deleteRiskTarget)
            setSelectedRiskId(null)
            setDeleteRiskTarget(null)
          }
        }}
        onCancel={() => setDeleteRiskTarget(null)}
      />

      <ConfirmDeleteModal
        open={showBulkConfirm}
        title={`¿Eliminar ${selectedIds.size} riesgo${selectedIds.size === 1 ? '' : 's'}?`}
        onConfirm={() => {
          bulkDeleteRisks(Array.from(selectedIds))
          exitSelectionMode()
          setShowBulkConfirm(false)
        }}
        onCancel={() => setShowBulkConfirm(false)}
      />

      <InsufficientTokensModal
        open={riskBudget.showInsufficientModal}
        onClose={riskBudget.closeInsufficientModal}
        operationKey="risks_from_bpmn"
      />
    </div>
  )
}
