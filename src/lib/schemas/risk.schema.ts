/**
 * risk.schema — Zod schemas para validar filas antes de upsert a Supabase.
 * Schemas permisivos: campos opcionales mantienen compatibilidad con data legacy.
 */

import { z } from 'zod'

const ScoreValue = z.union([z.literal(1), z.literal(3), z.literal(5)])
const Probability = z.number().int().min(1).max(5)

/** Fila para la tabla `risk_controls` (snake_case). */
export const ControlRowSchema = z.object({
  id: z.string().uuid(),
  risk_id: z.string().uuid(),
  description: z.string().optional(),
  type: ScoreValue.optional(),
  nature: ScoreValue.optional(),
  doc: ScoreValue.optional(),
  freq: ScoreValue.optional(),
  evidence: ScoreValue.optional(),
  segregation: ScoreValue.optional(),
  training: ScoreValue.optional(),
  monitoring: ScoreValue.optional(),
  mitigates: z.enum(['Probabilidad', 'Impacto', 'Ambos']).optional(),
  score: z.number().optional(),
  effectiveness: z.string().optional(),
})

export type ControlRow = z.infer<typeof ControlRowSchema>

/** Fila para la tabla `risks` (snake_case). */
export const RiskRowSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  company_id: z.string(),
  process_step: z.string().optional(),
  title: z.string().min(1).max(500),
  risk_cause: z.string().optional(),
  risk_event: z.string().optional(),
  risk_effect: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(['Operacional', 'Seguridad Info', 'Cumplimiento', 'Fisico']).optional(),
  inherent_probability: Probability.optional(),
  inherent_impact: Probability.optional(),
  residual_probability: Probability.optional(),
  residual_impact: Probability.optional(),
  bpmn_element_id: z.string().nullable().optional(),
})

export type RiskRow = z.infer<typeof RiskRowSchema>
