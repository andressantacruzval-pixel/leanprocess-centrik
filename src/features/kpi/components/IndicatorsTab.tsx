import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ConfirmUnsavedModal } from '@/components/ui/ConfirmUnsavedModal'
import { useAsync } from '@/hooks/useAsync'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import {
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Activity,
  GitBranch,
  Users,
  Loader2,
  Pencil,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { generateIndicators } from '@/lib/claude'
import { useIndicatorAiSuggest } from '../hooks/useIndicatorAiSuggest'
import { exportIndicatorsToExcel } from '@/utils/indicatorExcelExporter'
import { useCompanyStore } from '@/stores/companyStore'
import { useIndicatorStore, type StoredIndicator } from '@/stores/indicatorStore'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { toast } from '@/stores/toastStore'

interface IndicatorsTabProps {
  processId: string
  processName: string
  description?: string
  bpmnXml: string
  isExpanded?: boolean
}

function formatRange(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? null
  const hi = max ?? null
  if (lo === null && hi === null) return '—'
  if (lo !== null && hi !== null) return `${lo} – ${hi}`
  if (lo !== null) return `≥ ${lo}`
  return `≤ ${hi}`
}

const UNIT_OPTIONS = ['%', 'Unidades', 'Dias', 'Horas', 'Minutos', 'Veces', 'USD', 'Otro']
const FREQUENCY_OPTIONS = [
  'Diario', 'Semanal', 'Quincenal', 'Mensual',
  'Bimestral', 'Trimestral', 'Semestral', 'Anual',
]

export function IndicatorsTab({ processId, processName, description, bpmnXml, isExpanded }: IndicatorsTabProps) {
  const companyName = useCompanyStore((s) => s.company?.name)
  const allIndicators = useIndicatorStore((s) => s.indicators)
  const replaceProcessIndicators = useIndicatorStore((s) => s.replaceProcessIndicators)
  const updateIndicator = useIndicatorStore((s) => s.updateIndicator)
  const removeIndicator = useIndicatorStore((s) => s.removeIndicator)
  const addIndicator = useIndicatorStore((s) => s.addIndicator)

  const indicators = useMemo(
    () => allIndicators.filter((i) => i.process_id === processId),
    [allIndicators, processId]
  )

  const { loading, error, run } = useAsync()
  const indicatorBudget = useTokenBudget({ operationKey: 'indicators' })
  const [editingId, setEditingId] = useState<string | null>(null)

  const { handleAiSuggestOne, isAiSuggesting } = useIndicatorAiSuggest({
    bpmnXml,
    processName,
    companyName,
    selectedIndicatorId: editingId,
    indicators,
    indicatorBudget,
    updateIndicator,
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // ---- BPMN summary ----
  const bpmnSummary = useMemo(() => {
    if (!bpmnXml) return null
    try {
      const parsed = parseBpmnXml(bpmnXml)
      return {
        activities: parsed.activities.length,
        decisions: parsed.decisions.length,
        roles: parsed.lanes.length,
      }
    } catch { return null }
  }, [bpmnXml])

  // ---- Generate with AI ----
  async function handleGenerate() {
    await indicatorBudget.run(async () => {
      await run(async () => {
        const result = await generateIndicators({ name: processName, description, bpmnXml })
        replaceProcessIndicators(processId, result.indicadores.map(ind => ({
          name: ind.nombre,
          description: ind.objetivo,
          formula: ind.formula,
          data_source: ind.fuente_datos,
          unit: ind.unidad_medida,
          frequency: ind.frecuencia,
          target_value: ind.meta,
          threshold_green_min: ind.umbral_verde_min,
          threshold_green_max: ind.umbral_verde_max,
          threshold_yellow_min: ind.umbral_amarillo_min,
          threshold_yellow_max: ind.umbral_amarillo_max,
          threshold_red_min: ind.umbral_rojo_min,
          threshold_red_max: ind.umbral_rojo_max,
          owner: ind.responsable_reporte,
          reporter: ind.responsable_monitoreo,
        })))
      })
    })
  }

  // ---- Add blank indicator ----
  function handleAddBlank() {
    const indicator = addIndicator(processId, {
      name: 'Nuevo indicador',
      description: '',
      formula: '',
      data_source: '',
      unit: '%',
      frequency: 'Mensual',
      target_value: '',
      threshold_green_min: null,
      threshold_green_max: null,
      threshold_yellow_min: null,
      threshold_yellow_max: null,
      threshold_red_min: null,
      threshold_red_max: null,
      owner: '',
      reporter: '',
    })
    setEditingId(indicator.id)
  }

  // ---- Export ----
  async function handleExport() {
    const toExport = indicators.map(ind => ({
      name: ind.name,
      objective: ind.description,
      formula: ind.formula,
      data_source: ind.data_source,
      unit_of_measure: ind.unit,
      frequency: ind.frequency,
      target_value: ind.target_value,
      threshold_green_min: ind.threshold_green_min,
      threshold_green_max: ind.threshold_green_max,
      threshold_yellow_min: ind.threshold_yellow_min,
      threshold_yellow_max: ind.threshold_yellow_max,
      threshold_red_min: ind.threshold_red_min,
      threshold_red_max: ind.threshold_red_max,
      responsible_report: ind.owner,
      responsible_monitoring: ind.reporter,
    }))
    if (toExport.length === 0) return
    await exportIndicatorsToExcel(toExport, processName, companyName || undefined)
  }

  const editingIndicator = indicators.find(i => i.id === editingId) ?? null

  const handleIndicatorUpdate = useCallback((updates: Partial<StoredIndicator>) => {
    if (!editingIndicator) return
    updateIndicator(editingIndicator.id, updates)
    toast.success('Indicador actualizado.')
  }, [editingIndicator, updateIndicator])

  // ---- No BPMN and no saved indicators ----
  if (!bpmnXml && indicators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={48} className="text-white/20 mb-4" />
        <h3 className="text-lg font-semibold text-white/60 mb-2">Diagrama BPMN no disponible</h3>
        <p className="text-sm text-white/30 max-w-md">
          Genera primero el diagrama BPMN del proceso para poder crear indicadores con IA, o agrega indicadores manualmente.
        </p>
        <button
          onClick={handleAddBlank}
          className="mt-6 p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-colors"
          title="Agregar indicador"
        >
          <Plus size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${isExpanded ? 'p-5' : ''}`}>
      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {bpmnXml && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || indicatorBudget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {(loading || indicatorBudget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {(loading || indicatorBudget.isConsuming) ? 'Generando...' : indicators.length > 0 ? 'Regenerar con IA' : 'Generar con IA'}
            <TokenCostBadge operationKey="indicators" />
          </button>
        )}

        <button
          onClick={handleAddBlank}
          className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/10 transition-colors"
          title="Agregar indicador"
        >
          <Plus size={13} />
        </button>

        {indicators.length > 0 && (
          <div className="ml-auto">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 border border-white/10 text-[11px] font-medium transition-colors"
            >
              <FileSpreadsheet size={12} /> Exportar Excel
              <span className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-white/40">{indicators.length}</span>
            </button>
          </div>
        )}
      </div>

      {/* BPMN Summary */}
      {bpmnSummary && (
        <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
          <div className="flex items-center gap-1.5 text-white/50">
            <Activity size={12} className="text-cyan-400" />
            <span className="text-white/70 font-medium">{bpmnSummary.activities}</span> actividades
          </div>
          <div className="flex items-center gap-1.5 text-white/50">
            <GitBranch size={12} className="text-cyan-400" />
            <span className="text-white/70 font-medium">{bpmnSummary.decisions}</span> decisiones
          </div>
          <div className="flex items-center gap-1.5 text-white/50">
            <Users size={12} className="text-cyan-400" />
            <span className="text-white/70 font-medium">{bpmnSummary.roles}</span> roles
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{error}</div>
      )}

      {/* ── Indicators List ── */}
      {indicators.length > 0 && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_52px_32px] min-[420px]:grid-cols-[1fr_70px_52px_32px] min-[520px]:grid-cols-[1fr_90px_70px_52px_32px] gap-0 bg-white/[0.05] border-b border-white/5 px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
            <div>Indicador</div>
            <div className="hidden min-[520px]:block">Frecuencia</div>
            <div className="hidden min-[420px]:block">Meta</div>
            <div>Estado</div>
            <div></div>
          </div>

          {/* Rows */}
          {indicators.map((ind) => {
            const isRowExpanded = expandedId === ind.id
            return (
              <div key={ind.id} className="border-b border-white/5 last:border-b-0">
                {/* Main row */}
                <div
                  className="grid grid-cols-[1fr_52px_32px] min-[420px]:grid-cols-[1fr_70px_52px_32px] min-[520px]:grid-cols-[1fr_90px_70px_52px_32px] gap-0 px-4 py-3 items-center transition-colors hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => setExpandedId(isRowExpanded ? null : ind.id)}
                >
                  <div className="pr-3 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{ind.name}</p>
                    <p className="text-[11px] text-white/30 truncate mt-0.5">{ind.description}</p>
                  </div>
                  <div className="hidden min-[520px]:block">
                    <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/60 border border-white/5">{ind.frequency}</span>
                  </div>
                  <div className="hidden min-[420px]:block">
                    <span className="text-xs text-white/70 font-medium">{ind.target_value}</span>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    title={`Verde: ${formatRange(ind.threshold_green_min, ind.threshold_green_max)} | Amarillo: ${formatRange(ind.threshold_yellow_min, ind.threshold_yellow_max)} | Rojo: ${formatRange(ind.threshold_red_min, ind.threshold_red_max)}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  </div>
                  <div className="flex items-center justify-center">
                    {isRowExpanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isRowExpanded && (
                  <div className="px-6 pb-4 pt-1 bg-white/[0.02] border-t border-white/5 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <DetailField label="Formula" value={ind.formula} />
                      <DetailField label="Fuente de datos" value={ind.data_source} />
                      <DetailField label="Unidad de medida" value={ind.unit} />
                      <DetailField label="Frecuencia" value={ind.frequency} />
                      <DetailField label="Responsable reporte" value={ind.owner} />
                      <DetailField label="Responsable monitoreo" value={ind.reporter} />
                    </div>

                    {/* Thresholds detail */}
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Umbrales del Semaforo</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-[10px] text-green-400 font-semibold uppercase">Verde</span>
                          </div>
                          <p className="text-xs text-white/70">{formatRange(ind.threshold_green_min, ind.threshold_green_max)}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-yellow-400" />
                            <span className="text-[10px] text-yellow-400 font-semibold uppercase">Amarillo</span>
                          </div>
                          <p className="text-xs text-white/70">{formatRange(ind.threshold_yellow_min, ind.threshold_yellow_max)}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            <span className="text-[10px] text-red-400 font-semibold uppercase">Rojo</span>
                          </div>
                          <p className="text-xs text-white/70">{formatRange(ind.threshold_red_min, ind.threshold_red_max)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(ind.id) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 text-[11px] transition-colors"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(ind.id) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/15 text-red-400/70 hover:text-red-400 text-[11px] transition-colors"
                      >
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && indicators.length === 0 && bpmnXml && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles size={40} className="text-white/10 mb-3" />
          <p className="text-sm text-white/30">
            Haz clic en &quot;Generar con IA&quot; para crear KPIs basados en el diagrama BPMN.
          </p>
        </div>
      )}

      {/* Saved indicator count */}
      {indicators.length > 0 && (
        <p className="text-[10px] text-white/20 text-center">
          {indicators.length} indicador{indicators.length !== 1 ? 'es' : ''} guardado{indicators.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ── Edit Modal ── */}
      {editingIndicator && (
        <EditModal
          indicator={editingIndicator}
          onUpdate={handleIndicatorUpdate}
          onClose={() => setEditingId(null)}
          onAiSuggest={handleAiSuggestOne}
          isAiSuggesting={isAiSuggesting}
          canAiSuggest={!!bpmnXml}
        />
      )}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title="¿Eliminar este indicador?"
        onConfirm={() => {
          if (deleteTarget) { removeIndicator(deleteTarget); setDeleteTarget(null) }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <InsufficientTokensModal
        open={indicatorBudget.showInsufficientModal}
        onClose={indicatorBudget.closeInsufficientModal}
        operationKey="indicators"
      />
    </div>
  )
}

// ── Detail field helper ──
function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-white/70">{value || '-'}</p>
    </div>
  )
}

// ── Edit Modal ──
function EditModal({
  indicator,
  onUpdate,
  onClose,
  onAiSuggest,
  isAiSuggesting = false,
  canAiSuggest = false,
}: {
  indicator: StoredIndicator
  onUpdate: (updates: Partial<StoredIndicator>) => void
  onClose: () => void
  onAiSuggest?: () => Promise<void>
  isAiSuggesting?: boolean
  canAiSuggest?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [trackedId, setTrackedId] = useState(indicator.id)
  const [draft, setDraft] = useState<StoredIndicator>({ ...indicator })
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  if (trackedId !== indicator.id) {
    setTrackedId(indicator.id)
    setDraft({ ...indicator })
  }

  // Sincronizar draft cuando la IA termina de generar (isAiSuggesting: true → false).
  // El store se actualiza con el resultado de la IA pero el draft local no lo reflejaba.
  const wasAiSuggesting = useRef(false)
  useEffect(() => {
    if (wasAiSuggesting.current && !isAiSuggesting) {
      setDraft({ ...indicator })
    }
    wasAiSuggesting.current = isAiSuggesting
  }, [isAiSuggesting, indicator])

  const isDirty = JSON.stringify(draft) !== JSON.stringify(indicator)
  const handleFieldChange = (updates: Partial<StoredIndicator>) =>
    setDraft(prev => ({ ...prev, ...updates }))
  const handleSave = () => { onUpdate(draft); onClose() }
  const handleCloseAttempt = () => { if (isDirty) setShowConfirmClose(true); else onClose() }

  const f = "w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"

  // ── Vista expandida: popup nuevo centrado ──
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-200">
        <div className="w-full max-w-4xl rounded-2xl bg-[#0b1020] border border-white/10 shadow-[0_8px_60px_rgba(0,0,0,0.8)] flex flex-col max-h-[88vh]">

          {/* Header expandido */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Activity size={16} className="text-cyan-400" />
              </div>
              <div>
                <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-semibold">Indicador de Desempeño</p>
                <p className="text-base font-semibold text-white leading-tight">{indicator.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onAiSuggest && (
                <button
                  onClick={onAiSuggest}
                  disabled={!canAiSuggest || isAiSuggesting}
                  title={canAiSuggest ? 'Sugerir indicador con IA' : 'Necesitas un diagrama BPMN para usar esta función'}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAiSuggesting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  IA
                </button>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 text-[11px] font-medium transition-colors"
              >
                <Minimize2 size={12} /> Vista compacta
              </button>
              <button onClick={handleCloseAttempt} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Cuerpo: 2 columnas */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-[3fr_2fr]">

            {/* Izquierda: campos generales */}
            <div className="p-6 space-y-4 border-b md:border-b-0 md:border-r border-white/[0.06]">
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.18em]">Información General</p>
              <ModalField label="Nombre del Indicador">
                <input type="text" value={draft.name} onChange={e => handleFieldChange({ name: e.target.value })} className={f} />
              </ModalField>
              <ModalField label="Objetivo / Descripción">
                <textarea value={draft.description} onChange={e => handleFieldChange({ description: e.target.value })} rows={4}
                  className={`${f} resize-none`} />
              </ModalField>
              <ModalField label="Fórmula de Cálculo">
                <input type="text" value={draft.formula} onChange={e => handleFieldChange({ formula: e.target.value })} className={f} placeholder="ej. (Ventas reales / Meta) × 100" />
              </ModalField>
              <ModalField label="Fuente de Datos">
                <input type="text" value={draft.data_source} onChange={e => handleFieldChange({ data_source: e.target.value })} className={f} placeholder="ej. Sistema ERP, Base de datos..." />
              </ModalField>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <ModalField label="Unidad">
                  <select value={draft.unit} onChange={e => handleFieldChange({ unit: e.target.value })} className={f}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u} className="bg-[#0b1020] text-white">{u}</option>)}
                  </select>
                </ModalField>
                <ModalField label="Frecuencia">
                  <select value={draft.frequency} onChange={e => handleFieldChange({ frequency: e.target.value })} className={f}>
                    {FREQUENCY_OPTIONS.map(fr => <option key={fr} value={fr} className="bg-[#0b1020] text-white">{fr}</option>)}
                  </select>
                </ModalField>
                <ModalField label="Meta">
                  <input type="text" value={draft.target_value} onChange={e => handleFieldChange({ target_value: e.target.value })} className={f} placeholder="≥ 95%" />
                </ModalField>
              </div>
            </div>

            {/* Derecha: semáforo + responsables */}
            <div className="p-6 space-y-6 bg-white/[0.01]">
              <div className="space-y-3">
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.18em]">Semáforo de Desempeño</p>
                <div className="p-4 rounded-2xl bg-green-500/[0.08] border border-green-500/20 flex items-start gap-3.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-green-400 shrink-0 mt-0.5 shadow-[0_0_10px_rgba(74,222,128,0.7)]" />
                  <div className="flex-1">
                    <p className="text-[10px] text-green-400/90 font-bold uppercase tracking-wider mb-2">Verde — Óptimo</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-green-400/50 mb-1">Mínimo</p>
                        <input type="number" value={draft.threshold_green_min ?? ''}
                          onChange={e => handleFieldChange({ threshold_green_min: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-green-500/[0.08] border border-green-500/25 text-white text-sm focus:outline-none focus:border-green-400/70"
                          placeholder="ej. 90" />
                      </div>
                      <div>
                        <p className="text-[9px] text-green-400/50 mb-1">Máximo</p>
                        <input type="number" value={draft.threshold_green_max ?? ''}
                          onChange={e => handleFieldChange({ threshold_green_max: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-green-500/[0.08] border border-green-500/25 text-white text-sm focus:outline-none focus:border-green-400/70"
                          placeholder="ej. 100" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-yellow-500/[0.08] border border-yellow-500/20 flex items-start gap-3.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-400 shrink-0 mt-0.5 shadow-[0_0_10px_rgba(234,179,8,0.7)]" />
                  <div className="flex-1">
                    <p className="text-[10px] text-yellow-400/90 font-bold uppercase tracking-wider mb-2">Amarillo — Alerta</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-yellow-400/50 mb-1">Mínimo</p>
                        <input type="number" value={draft.threshold_yellow_min ?? ''}
                          onChange={e => handleFieldChange({ threshold_yellow_min: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-yellow-500/[0.08] border border-yellow-500/25 text-white text-sm focus:outline-none focus:border-yellow-400/70"
                          placeholder="ej. 70" />
                      </div>
                      <div>
                        <p className="text-[9px] text-yellow-400/50 mb-1">Máximo</p>
                        <input type="number" value={draft.threshold_yellow_max ?? ''}
                          onChange={e => handleFieldChange({ threshold_yellow_max: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-yellow-500/[0.08] border border-yellow-500/25 text-white text-sm focus:outline-none focus:border-yellow-400/70"
                          placeholder="ej. 89" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-red-500/[0.08] border border-red-500/20 flex items-start gap-3.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-400 shrink-0 mt-0.5 shadow-[0_0_10px_rgba(248,113,113,0.7)]" />
                  <div className="flex-1">
                    <p className="text-[10px] text-red-400/90 font-bold uppercase tracking-wider mb-2">Rojo — Crítico</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-red-400/50 mb-1">Mínimo</p>
                        <input type="number" value={draft.threshold_red_min ?? ''}
                          onChange={e => handleFieldChange({ threshold_red_min: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-red-500/[0.08] border border-red-500/25 text-white text-sm focus:outline-none focus:border-red-400/70"
                          placeholder="ej. 0" />
                      </div>
                      <div>
                        <p className="text-[9px] text-red-400/50 mb-1">Máximo</p>
                        <input type="number" value={draft.threshold_red_max ?? ''}
                          onChange={e => handleFieldChange({ threshold_red_max: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-red-500/[0.08] border border-red-500/25 text-white text-sm focus:outline-none focus:border-red-400/70"
                          placeholder="ej. 69" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.18em]">Responsables</p>
                <ModalField label="Responsable de Reporte">
                  <input type="text" value={draft.owner} onChange={e => handleFieldChange({ owner: e.target.value })} className={f} placeholder="Nombre del responsable..." />
                </ModalField>
                <ModalField label="Responsable de Monitoreo">
                  <input type="text" value={draft.reporter} onChange={e => handleFieldChange({ reporter: e.target.value })} className={f} placeholder="Nombre del responsable..." />
                </ModalField>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-white/[0.07] shrink-0 bg-white/[0.02]">
            <button onClick={onClose} className="px-4 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-all">
              Guardar
            </button>
          </div>
        </div>
        {showConfirmClose && (
          <ConfirmUnsavedModal onDiscard={onClose} onSave={handleSave} />
        )}
      </div>
    )
  }

  // ── Vista compacta: modal estándar ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-[#0d1420] border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Activity size={14} className="text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Indicador</p>
              <p className="text-sm font-semibold text-white truncate">{indicator.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-3">
            {onAiSuggest && (
              <button
                onClick={onAiSuggest}
                disabled={!canAiSuggest || isAiSuggesting}
                title={canAiSuggest ? 'Sugerir indicador con IA' : 'Necesitas un diagrama BPMN para usar esta función'}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAiSuggesting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                IA
              </button>
            )}
            <button onClick={() => setExpanded(true)} title="Vista ampliada"
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-cyan-400 transition-colors">
              <Maximize2 size={14} />
            </button>
            <button onClick={handleCloseAttempt} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Formulario compacto */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <ModalField label="Nombre">
            <input type="text" value={draft.name} onChange={e => handleFieldChange({ name: e.target.value })} className={f} />
          </ModalField>
          <ModalField label="Objetivo">
            <textarea value={draft.description} onChange={e => handleFieldChange({ description: e.target.value })} rows={2}
              className={`${f} resize-none`} />
          </ModalField>
          <ModalField label="Formula">
            <input type="text" value={draft.formula} onChange={e => handleFieldChange({ formula: e.target.value })} className={f} />
          </ModalField>
          <ModalField label="Fuente de datos">
            <input type="text" value={draft.data_source} onChange={e => handleFieldChange({ data_source: e.target.value })} className={f} />
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Unidad de medida">
              <select value={draft.unit} onChange={e => handleFieldChange({ unit: e.target.value })} className={f}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u} className="bg-[#0b1020] text-white">{u}</option>)}
              </select>
            </ModalField>
            <ModalField label="Frecuencia">
              <select value={draft.frequency} onChange={e => handleFieldChange({ frequency: e.target.value })} className={f}>
                {FREQUENCY_OPTIONS.map(fr => <option key={fr} value={fr} className="bg-[#0b1020] text-white">{fr}</option>)}
              </select>
            </ModalField>
          </div>
          <ModalField label="Meta">
            <input type="text" value={draft.target_value} onChange={e => handleFieldChange({ target_value: e.target.value })} className={f} />
          </ModalField>
          <div className="space-y-2">
            <p className="text-xs font-medium text-white/40">Semáforo de Desempeño</p>
            <div className="p-3 rounded-xl bg-green-500/[0.06] border border-green-500/20">
              <p className="text-[9px] text-green-400 font-bold uppercase tracking-wider mb-2">Verde — Óptimo</p>
              <div className="grid grid-cols-2 gap-2">
                <ModalField label="Mínimo" labelClass="text-green-400/50">
                  <input type="number" value={draft.threshold_green_min ?? ''}
                    onChange={e => handleFieldChange({ threshold_green_min: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-green-500/20 text-white text-sm focus:outline-none focus:border-green-500/50"
                    placeholder="ej. 90" />
                </ModalField>
                <ModalField label="Máximo" labelClass="text-green-400/50">
                  <input type="number" value={draft.threshold_green_max ?? ''}
                    onChange={e => handleFieldChange({ threshold_green_max: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-green-500/20 text-white text-sm focus:outline-none focus:border-green-500/50"
                    placeholder="ej. 100" />
                </ModalField>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-yellow-500/[0.06] border border-yellow-500/20">
              <p className="text-[9px] text-yellow-400 font-bold uppercase tracking-wider mb-2">Amarillo — Alerta</p>
              <div className="grid grid-cols-2 gap-2">
                <ModalField label="Mínimo" labelClass="text-yellow-400/50">
                  <input type="number" value={draft.threshold_yellow_min ?? ''}
                    onChange={e => handleFieldChange({ threshold_yellow_min: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-yellow-500/20 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                    placeholder="ej. 70" />
                </ModalField>
                <ModalField label="Máximo" labelClass="text-yellow-400/50">
                  <input type="number" value={draft.threshold_yellow_max ?? ''}
                    onChange={e => handleFieldChange({ threshold_yellow_max: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-yellow-500/20 text-white text-sm focus:outline-none focus:border-yellow-500/50"
                    placeholder="ej. 89" />
                </ModalField>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-red-500/[0.06] border border-red-500/20">
              <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider mb-2">Rojo — Crítico</p>
              <div className="grid grid-cols-2 gap-2">
                <ModalField label="Mínimo" labelClass="text-red-400/50">
                  <input type="number" value={draft.threshold_red_min ?? ''}
                    onChange={e => handleFieldChange({ threshold_red_min: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-red-500/20 text-white text-sm focus:outline-none focus:border-red-500/50"
                    placeholder="ej. 0" />
                </ModalField>
                <ModalField label="Máximo" labelClass="text-red-400/50">
                  <input type="number" value={draft.threshold_red_max ?? ''}
                    onChange={e => handleFieldChange({ threshold_red_max: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-red-500/20 text-white text-sm focus:outline-none focus:border-red-500/50"
                    placeholder="ej. 69" />
                </ModalField>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Responsable reporte">
              <input type="text" value={draft.owner} onChange={e => handleFieldChange({ owner: e.target.value })} className={f} />
            </ModalField>
            <ModalField label="Responsable monitoreo">
              <input type="text" value={draft.reporter} onChange={e => handleFieldChange({ reporter: e.target.value })} className={f} />
            </ModalField>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/10 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-medium hover:from-cyan-500 hover:to-blue-500 transition-all">
            Guardar
          </button>
        </div>
      </div>
      {showConfirmClose && (
        <ConfirmUnsavedModal onDiscard={onClose} onSave={handleSave} />
      )}
    </div>
  )
}

function ModalField({ label, labelClass, children }: { label: string; labelClass?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={`block text-xs font-medium mb-1 ${labelClass || 'text-white/40'}`}>{label}</label>
      {children}
    </div>
  )
}
