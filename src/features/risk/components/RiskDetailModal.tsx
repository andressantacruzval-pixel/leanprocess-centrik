import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { X, Shield, Plus, Trash2, AlertTriangle, Pencil, Maximize2, Minimize2, Sparkles, Loader2 } from 'lucide-react'
import type { RiskItem, ControlItem, RiskCategory } from '@/types/risk'
import {
  RISK_CATEGORIES, PROBABILITY_LABELS, IMPACT_LABELS,
  getRiskLevel, EFFECTIVENESS_COLORS,
  computeControlScore, calculateResidual,
} from '@/types/risk'
import { ControlModal } from './ControlModal'
import { ConfirmUnsavedModal } from '@/components/ui/ConfirmUnsavedModal'

interface RiskDetailModalProps {
  risk: RiskItem
  onUpdate: (updates: Partial<RiskItem>) => void
  onDelete: () => void
  onAddControl: () => void
  onUpdateControl: (controlId: string, updates: Partial<ControlItem>) => void
  onDeleteControl: (controlId: string) => void
  onClose: () => void
  onAiSuggest?: () => Promise<void>
  isAiSuggesting?: boolean
  canAiSuggest?: boolean
}

export function RiskDetailModal({
  risk, onUpdate, onDelete, onAddControl,
  onUpdateControl, onDeleteControl, onClose,
  onAiSuggest, isAiSuggesting = false, canAiSuggest = false,
}: RiskDetailModalProps) {
  const [editingControl, setEditingControl] = useState<ControlItem | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [trackedId, setTrackedId] = useState(risk.id)
  const [draft, setDraft] = useState<RiskItem>({ ...risk })
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  if (trackedId !== risk.id) {
    setTrackedId(risk.id)
    setDraft({ ...risk })
  }

  // Sincronizar draft cuando la IA termina de generar (isAiSuggesting: true → false).
  const wasAiSuggesting = useRef(false)
  useEffect(() => {
    if (wasAiSuggesting.current && !isAiSuggesting) {
      setDraft({ ...risk })
    }
    wasAiSuggesting.current = isAiSuggesting
  }, [isAiSuggesting, risk])

  // controls tienen su propio CRUD (addControl/deleteControl) — excluirlos de la comparación
  const { controls: _dc, ...draftForDirty } = draft
  const { controls: _rc, ...riskForDirty } = risk
  const isDirty = JSON.stringify(draftForDirty) !== JSON.stringify(riskForDirty)

  const handleFieldChange = useCallback((updates: Partial<RiskItem>) => {
    setDraft(prev => ({ ...prev, ...updates }))
  }, [])

  // No pasar controls al update — se manejan por separado y draft.controls puede estar desactualizado
  const handleSave = () => {
    const { controls: _controls, ...riskUpdates } = draft
    onUpdate(riskUpdates)
    onClose()
  }
  const handleCloseAttempt = () => { if (isDirty) setShowConfirmClose(true); else onClose() }

  const inherentLevel = getRiskLevel(draft.inherentProbability, draft.inherentImpact)

  /**
   * El residual se calcula AQUI, en vivo.
   *
   * Antes se leia `draft.residualProbability/Impact`, que son los valores que traia
   * el riesgo al abrirse: mover el impacto inherente no movia el residual hasta
   * guardar y volver a entrar. El nivel inherente si reaccionaba, asi que los dos
   * bloques se contradecian en pantalla.
   *
   * Los inherentes salen del `draft` —lo que estas editando ahora— y los controles
   * de `risk`, que es lo que hay en el store: `draft.controls` puede estar
   * desactualizado porque los controles se gestionan por separado.
   *
   * Es la MISMA cuenta que hara el store al guardar (`recalc` sobre
   * `{...current, ...updates}`, y `updates` no lleva controles), asi que lo que ves
   * es lo que se va a almacenar.
   */
  const residual = useMemo(
    () => calculateResidual(draft.inherentProbability, draft.inherentImpact, risk.controls),
    [draft.inherentProbability, draft.inherentImpact, risk.controls]
  )
  const residualLevel = getRiskLevel(residual.residualProbability, residual.residualImpact)

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className={`bg-[#0d1420] rounded-2xl shadow-xl w-full mx-4 border border-white/10 max-h-[90vh] flex flex-col transition-all duration-300 ${expanded ? 'max-w-3xl' : 'max-w-2xl'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Detalle del Riesgo</h3>
            </div>
            <div className="flex items-center gap-1">
              {onAiSuggest && (
                <button
                  onClick={onAiSuggest}
                  disabled={!canAiSuggest || isAiSuggesting}
                  title={canAiSuggest ? 'Sugerir riesgo con IA' : 'Necesitas un diagrama BPMN para usar esta función'}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isAiSuggesting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  IA
                </button>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60"
                title={expanded ? 'Reducir' : 'Expandir'}
              >
                {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button onClick={handleCloseAttempt} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Title + Description — side by side when expanded */}
            <div className={expanded ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-5'}>
              <div>
                <label className="block text-[10px] font-medium text-white/40 mb-1">Nombre del riesgo</label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => handleFieldChange({ title: e.target.value })}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white focus:ring-1 focus:ring-amber-500/50"
                />
              </div>

              {/* Declaracion taxonomica: Causa(s) → Evento → Efecto(s) */}
              <div>
                <label className="block text-[10px] font-medium text-white/40 mb-1">Declaracion del riesgo</label>
                <textarea
                  value={draft.description}
                  onChange={(e) => handleFieldChange({ description: e.target.value })}
                  rows={expanded ? 3 : 3}
                  className="w-full px-3 py-2 border border-white/10 rounded-lg text-xs bg-white/5 text-white focus:ring-1 focus:ring-amber-500/50 resize-none"
                  placeholder="Por [causa(s)] se podría [evento de riesgo], lo que generaría [efecto(s)]."
                />
                <p className="text-[9px] text-white/20 mt-1">Taxonomia: causa(s) → evento → efecto(s) en un solo parrafo.</p>
              </div>
            </div>{/* end grid wrapper */}

            {/* Category + Step */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-white/40 mb-1">Tipo de riesgo</label>
                <CreatableSelect
                  options={RISK_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  value={draft.category || ''}
                  onChange={(v) => handleFieldChange({ category: v as RiskCategory })}
                  placeholder="Tipo..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-white/40 mb-1">Actividad BPMN</label>
                <input type="text" value={draft.processStep} onChange={(e) => handleFieldChange({ processStep: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-white/10 rounded-lg text-[11px] bg-white/5 text-white focus:ring-1 focus:ring-amber-500/50" placeholder="Actividad asociada..." />
              </div>
            </div>

            {/* ═══ EVALUATION SECTION ═══ */}
            <div className="border-t border-white/5 pt-4">
              <h4 className="text-[11px] font-semibold text-white/60 mb-3 flex items-center gap-2">
                <Shield size={12} className="text-cyan-400" />
                Evaluacion de riesgos
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Inherent Risk */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-white/50">Riesgo Inherente</span>
                  <div>
                    <label className="block text-[9px] text-white/30 mb-0.5">Impacto</label>
                    <select value={draft.inherentImpact} onChange={(e) => handleFieldChange({ inherentImpact: Number(e.target.value) })}
                      className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-medium border-0 text-white ${inherentImpact2Color(draft.inherentImpact)}`}>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v} className="bg-[#0b1020] text-white">{v} - {IMPACT_LABELS[v]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-white/30 mb-0.5">Probabilidad</label>
                    <select value={draft.inherentProbability} onChange={(e) => handleFieldChange({ inherentProbability: Number(e.target.value) })}
                      className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-medium border-0 text-white ${prob2Color(draft.inherentProbability)}`}>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v} className="bg-[#0b1020] text-white">{v} - {PROBABILITY_LABELS[v]}</option>)}
                    </select>
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-center text-[10px] font-bold text-white ${inherentLevel.color}`}>
                    {inherentLevel.label}
                  </div>
                </div>

                {/* Controls — simplified cards, click to open ControlModal */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-white/50">Controles</span>
                    <button onClick={onAddControl} className="p-1 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20">
                      <Plus size={12} />
                    </button>
                  </div>
                  {risk.controls.length === 0 ? (
                    <p className="text-[9px] text-white/20 text-center py-4">Sin controles</p>
                  ) : (
                    <div className="space-y-1.5">
                      {risk.controls.map((c) => {
                        const { score, effectiveness } = computeControlScore(c)
                        return (
                          <div key={c.id} className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-2 flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              effectiveness === 'Optimo' ? 'bg-cyan-400' :
                              effectiveness === 'Bueno' ? 'bg-emerald-400' :
                              effectiveness === 'Regular' ? 'bg-yellow-400' :
                              effectiveness === 'Debil' ? 'bg-orange-400' : 'bg-red-400'
                            }`} />
                            <p className="text-[9px] text-white/60 flex-1 truncate">{c.description || 'Sin descripcion'}</p>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${EFFECTIVENESS_COLORS[effectiveness]}`}>
                              {score}/40
                            </span>
                            <button
                              onClick={() => setEditingControl(c)}
                              className="p-0.5 text-white/20 hover:text-cyan-400 transition-colors"
                              title="Evaluar control"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={() => onDeleteControl(c.id)}
                              className="p-0.5 text-white/15 hover:text-red-400 transition-colors"
                              title="Eliminar control"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Residual Risk */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-white/50">Riesgo Residual</span>
                  <div>
                    <label className="block text-[9px] text-white/30 mb-0.5">Impacto</label>
                    <div className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-medium text-white ${inherentImpact2Color(residual.residualImpact)}`}>
                      {residual.residualImpact} - {IMPACT_LABELS[residual.residualImpact]}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] text-white/30 mb-0.5">Probabilidad</label>
                    <div className={`w-full px-2 py-1.5 rounded-lg text-[10px] font-medium text-white ${prob2Color(residual.residualProbability)}`}>
                      {residual.residualProbability} - {PROBABILITY_LABELS[residual.residualProbability]}
                    </div>
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-center text-[10px] font-bold text-white ${residualLevel.color}`}>
                    {residualLevel.label}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 shrink-0">
            <button onClick={() => { onDelete(); onClose() }}
              className="px-3 py-1.5 text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              Eliminar riesgo
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose}
                className="px-4 py-2 text-xs text-white/50 hover:text-white/80 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-xs font-medium hover:from-amber-500 hover:to-orange-500 transition-all">
                Guardar
              </button>
            </div>
          </div>
        </div>
      </div>

      {showConfirmClose && (
        <ConfirmUnsavedModal onDiscard={onClose} onSave={handleSave} />
      )}

      {/* Control evaluation in separate modal */}
      {editingControl && (
        <ControlModal
          control={editingControl}
          onSave={(updates) => {
            onUpdateControl(editingControl.id, updates)
            setEditingControl(null)
          }}
          onClose={() => setEditingControl(null)}
        />
      )}
    </>
  )
}

// ── Color helpers ────────────────────────────────────────────────────

function inherentImpact2Color(v: number): string {
  if (v >= 4) return 'bg-orange-500/80'
  if (v >= 3) return 'bg-yellow-500/80'
  if (v >= 2) return 'bg-emerald-500/80'
  return 'bg-emerald-600/80'
}

function prob2Color(v: number): string {
  if (v >= 4) return 'bg-orange-500/80'
  if (v >= 3) return 'bg-yellow-500/80'
  if (v >= 2) return 'bg-emerald-500/60'
  return 'bg-emerald-600/60'
}
