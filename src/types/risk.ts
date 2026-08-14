// ── Risk Management Types ─────────────────────────────────────────────
// Based on RiskGuard methodology: 5×5 matrix, 8-variable control
// effectiveness, residual risk auto-calculation.

export type RiskCategory = 'Operacional' | 'Seguridad Info' | 'Cumplimiento' | 'Fisico'

export type EffectivenessLevel = 'Deficiente' | 'Debil' | 'Regular' | 'Bueno' | 'Optimo'

export type RiskLevel = 'Extremo' | 'Alto' | 'Moderado' | 'Bajo'

export type MitigationType = 'Probabilidad' | 'Impacto' | 'Ambos'

// ── Control: 8 variables scored 1 | 3 | 5 ────────────────────────────
export interface ControlItem {
  id: string
  description: string
  // 8 effectiveness variables (based on satellite methodology)
  doc: 1 | 3 | 5             // Documentacion: Sin Documentar(1) / Parcial(3) / Documentado(5)
  type: 1 | 3 | 5            // Implementacion: No Implementado(1) / Parcial(3) / Implementado(5)
  segregation: 1 | 3 | 5     // Responsable: No Existe(1) / Existe-Ejecuta(3) / Existe-Supervisa(5)
  evidence: 1 | 3 | 5        // Evidencia: Sin Evidencia(1) / Parcial(3) / Completa(5)
  freq: 1 | 3 | 5            // Frecuencia: Esporadica(1) / Periodica(3) / Permanente(5)
  nature: 1 | 3 | 5          // Oportunidad: Correctivo(1) / Detectivo(3) / Preventivo(5)
  training: 1 | 3 | 5        // Automatizacion: Manual(1) / Semi-Automatico(3) / Automatico(5)
  monitoring: 1 | 3 | 5      // Auditoria: Sin Auditoria(1) / Auditoria Parcial(3) / Auditoria Completa(5)
  mitigates: MitigationType
  // Computed
  score: number               // 8–40
  effectiveness: EffectivenessLevel
  // Optional: linked to BPMN element
  bpmnElementId?: string
}

// ── Risk Item ─────────────────────────────────────────────────────────
export interface RiskItem {
  id: string
  process_id: string
  company_id?: string
  processStep: string         // actividad BPMN asociada
  title: string
  riskCause: string
  riskEvent: string
  riskEffect: string
  description: string         // "Por [Causa], se podría [Evento], por lo cual [Efecto]."
  category: RiskCategory
  inherentProbability: number // 1-5
  inherentImpact: number      // 1-5
  controls: ControlItem[]
  residualProbability: number // calculated
  residualImpact: number      // calculated
  // Optional: linked to BPMN risk node
  bpmnElementId?: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────

export const RISK_CATEGORIES: RiskCategory[] = ['Operacional', 'Seguridad Info', 'Cumplimiento', 'Fisico']

export const PROBABILITY_LABELS: Record<number, string> = {
  1: 'Raro',
  2: 'Improbable',
  3: 'Posible',
  4: 'Probable',
  5: 'Frecuente',
}

export const IMPACT_LABELS: Record<number, string> = {
  1: 'Insignificante',
  2: 'Menor',
  3: 'Moderado',
  4: 'Mayor',
  5: 'Catastrofico',
}

// ── Effectiveness calculation ─────────────────────────────────────────

export function computeControlScore(c: Omit<ControlItem, 'score' | 'effectiveness'>): { score: number; effectiveness: EffectivenessLevel } {
  const score = c.type + c.nature + c.doc + c.freq + c.evidence + c.segregation + c.training + c.monitoring
  let effectiveness: EffectivenessLevel
  if (score >= 33) effectiveness = 'Optimo'
  else if (score >= 25) effectiveness = 'Bueno'
  else if (score >= 17) effectiveness = 'Regular'
  else if (score >= 9) effectiveness = 'Debil'
  else effectiveness = 'Deficiente'
  return { score, effectiveness }
}

export const EFFECTIVENESS_COLORS: Record<EffectivenessLevel, string> = {
  Deficiente: 'bg-red-500/20 text-red-400',
  Debil: 'bg-orange-500/20 text-orange-400',
  Regular: 'bg-yellow-500/20 text-yellow-400',
  Bueno: 'bg-emerald-500/20 text-emerald-400',
  Optimo: 'bg-cyan-500/20 text-cyan-400',
}

// ── Risk level from probability × impact ──────────────────────────────

export function getRiskLevel(probability: number, impact: number): { label: RiskLevel; color: string; hex: string } {
  const score = probability * impact
  if (score >= 15) return { label: 'Extremo', color: 'bg-red-500', hex: '#ef4444' }
  if (score >= 8) return { label: 'Alto', color: 'bg-orange-500', hex: '#f97316' }
  if (score >= 4) return { label: 'Moderado', color: 'bg-yellow-400', hex: '#facc15' }
  return { label: 'Bajo', color: 'bg-emerald-500', hex: '#10b981' }
}

// ── Heat map cell color ───────────────────────────────────────────────

export function heatMapCellColor(probability: number, impact: number): string {
  const score = probability * impact
  if (score >= 15) return 'bg-red-500/80'
  if (score >= 8) return 'bg-orange-500/80'
  if (score >= 4) return 'bg-yellow-400/80'
  return 'bg-emerald-500/80'
}

// ── Residual risk calculation ─────────────────────────────────────────

export function calculateResidual(
  prob: number,
  imp: number,
  controls: ControlItem[]
): { residualProbability: number; residualImpact: number } {
  let currentProb = prob
  let currentImp = imp

  const evaluated = controls.filter((c) => c.score > 0)

  evaluated.forEach((c) => {
    let reduction = 0
    if (c.score >= 33) reduction = 2
    else if (c.score >= 25) reduction = 1

    if (reduction > 0) {
      const affectsProb = c.mitigates === 'Probabilidad' || c.mitigates === 'Ambos'
      const affectsImp = c.mitigates === 'Impacto' || c.mitigates === 'Ambos'
      if (affectsProb) currentProb = Math.max(1, currentProb - reduction)
      if (affectsImp) currentImp = Math.max(1, currentImp - reduction)
    }
  })

  return { residualProbability: currentProb, residualImpact: currentImp }
}

// ── Control effectiveness factor definitions ──────────────────────────

export const CONTROL_FACTORS = [
  { key: 'doc' as const, label: 'Estado de Documentacion', options: [{ value: 1, label: 'Sin Documentar' }, { value: 3, label: 'Parcial' }, { value: 5, label: 'Documentado' }] },
  { key: 'type' as const, label: 'Estado Implementacion', options: [{ value: 1, label: 'No Implementado' }, { value: 3, label: 'Parcial' }, { value: 5, label: 'Implementado' }] },
  { key: 'segregation' as const, label: 'Responsable', options: [{ value: 1, label: 'No Existe' }, { value: 3, label: 'Si Existe - Ejecuta' }, { value: 5, label: 'Si Existe - Supervisa' }] },
  { key: 'evidence' as const, label: 'Estado de la Evidencia', options: [{ value: 1, label: 'Sin Evidencia' }, { value: 3, label: 'Parcial' }, { value: 5, label: 'Completa' }] },
  { key: 'freq' as const, label: 'Frecuencia', options: [{ value: 1, label: 'Esporadica' }, { value: 3, label: 'Periodica' }, { value: 5, label: 'Permanente' }] },
  { key: 'nature' as const, label: 'Oportunidad de Control', options: [{ value: 1, label: 'Correctivo' }, { value: 3, label: 'Detectivo' }, { value: 5, label: 'Preventivo' }] },
  { key: 'training' as const, label: 'Nivel de Automatizacion', options: [{ value: 1, label: 'Manual' }, { value: 3, label: 'Semi-Automatico' }, { value: 5, label: 'Automatico' }] },
  { key: 'monitoring' as const, label: 'Auditoria de Control', options: [{ value: 1, label: 'Sin Auditoria' }, { value: 3, label: 'Auditoria Parcial' }, { value: 5, label: 'Auditoria Completa' }] },
] as const
