// ── Riesgo de Activos de Información (ISO/IEC 27001 · 27005) — Fase 2 ──────
// Reutiliza la matriz 5×5 y la efectividad de 8 variables de los riesgos de
// proceso, pero el IMPACTO se evalúa en tres dimensiones (C·I·D) y el impacto
// del activo es el MAYOR de las tres. La PROBABILIDAD es única y se relaciona
// con ese mayor impacto. Los controles mitigan la probabilidad y/o dimensiones
// concretas del impacto; el residual se recalcula sobre las tres dimensiones.

import type { EffectivenessLevel } from './risk'

// Control de seguridad sobre un activo. Mismas 8 variables de efectividad que un
// control de riesgo, pero el objetivo de mitigación es C·I·D + probabilidad.
export interface AssetControl {
  id: string
  asset_id: string
  company_id?: string
  description: string
  // 8 variables de efectividad (escala 1 | 3 | 5, idéntica a los controles de riesgo)
  doc: 1 | 3 | 5
  type: 1 | 3 | 5
  segregation: 1 | 3 | 5
  evidence: 1 | 3 | 5
  freq: 1 | 3 | 5
  nature: 1 | 3 | 5
  training: 1 | 3 | 5
  monitoring: 1 | 3 | 5
  // Qué mitiga: la probabilidad y/o el impacto en dimensiones concretas.
  mitigates_probability: boolean
  mitigates_c: boolean
  mitigates_i: boolean
  mitigates_a: boolean
  // Derivados
  score: number
  effectiveness: EffectivenessLevel
  sort_order: number
  created_at: string
  updated_at: string
}

type ControlFactors = Pick<AssetControl, 'doc' | 'type' | 'segregation' | 'evidence' | 'freq' | 'nature' | 'training' | 'monitoring'>

// Puntaje 8-40 y nivel de efectividad (misma escala que computeControlScore de
// riesgos, replicada para no arrastrar el campo `mitigates` de aquel modelo).
export function computeAssetControlScore(c: ControlFactors): { score: number; effectiveness: EffectivenessLevel } {
  const score = c.type + c.nature + c.doc + c.freq + c.evidence + c.segregation + c.training + c.monitoring
  let effectiveness: EffectivenessLevel
  if (score >= 33) effectiveness = 'Optimo'
  else if (score >= 25) effectiveness = 'Bueno'
  else if (score >= 17) effectiveness = 'Regular'
  else if (score >= 9) effectiveness = 'Debil'
  else effectiveness = 'Deficiente'
  return { score, effectiveness }
}

// Reducción que aporta un control según su efectividad (igual que en riesgos:
// Óptimo baja 2 niveles, Bueno baja 1, por debajo no reduce).
function reductionOf(score: number): number {
  if (score >= 33) return 2
  if (score >= 25) return 1
  return 0
}

export interface AssetResidual {
  rc: number
  ri: number
  ra: number
  rProb: number
  residualImpact: number // mayor de rc, ri, ra
}

// Impacto inherente del activo = mayor de C·I·D.
export function assetInherentImpact(c?: number | null, i?: number | null, a?: number | null): number {
  return Math.max(c || 0, i || 0, a || 0)
}

// Recalcula el residual sobre las tres dimensiones y la probabilidad. Cada
// control resta su reducción a la probabilidad (si la mitiga) y a las
// dimensiones de impacto que declare mitigar. Nunca baja de 1 lo que ya tenía valor.
export function calculateAssetResidual(
  c: number | null | undefined,
  i: number | null | undefined,
  a: number | null | undefined,
  prob: number | null | undefined,
  controls: AssetControl[],
): AssetResidual {
  let rc = c || 0
  let ri = i || 0
  let ra = a || 0
  let rProb = prob || 0
  controls.forEach((ctrl) => {
    const red = reductionOf(ctrl.score)
    if (red <= 0) return
    if (ctrl.mitigates_probability && rProb > 0) rProb = Math.max(1, rProb - red)
    if (ctrl.mitigates_c && rc > 0) rc = Math.max(1, rc - red)
    if (ctrl.mitigates_i && ri > 0) ri = Math.max(1, ri - red)
    if (ctrl.mitigates_a && ra > 0) ra = Math.max(1, ra - red)
  })
  return { rc, ri, ra, rProb, residualImpact: Math.max(rc, ri, ra) }
}

// Valores por defecto de un control nuevo (deficiente hasta que se evalúe).
export function newAssetControlDefaults(): Omit<AssetControl, 'id' | 'asset_id' | 'created_at' | 'updated_at' | 'sort_order'> {
  return {
    description: '',
    doc: 1, type: 1, segregation: 1, evidence: 1, freq: 1, nature: 1, training: 1, monitoring: 1,
    mitigates_probability: false, mitigates_c: false, mitigates_i: false, mitigates_a: false,
    score: 8, effectiveness: 'Deficiente',
  }
}
