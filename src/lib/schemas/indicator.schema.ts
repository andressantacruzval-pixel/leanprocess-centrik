/**
 * indicator.schema — Zod schema para Indicator antes de upsert.
 */

import { z } from 'zod'

export const IndicatorRowSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  company_id: z.string(),
  name: z.string().min(1).max(500),
  formula: z.string().optional(),
  unit: z.string().optional(),
  frequency: z.string().optional(),
  target: z.number().optional(),
  threshold_green_min: z.number().nullable().optional(),
  threshold_green_max: z.number().nullable().optional(),
  threshold_yellow_min: z.number().nullable().optional(),
  threshold_yellow_max: z.number().nullable().optional(),
  threshold_red_min: z.number().nullable().optional(),
  threshold_red_max: z.number().nullable().optional(),
  responsible: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough()

export type IndicatorRow = z.infer<typeof IndicatorRowSchema>
