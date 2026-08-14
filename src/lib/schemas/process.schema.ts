/**
 * process.schema — Zod schemas para Macroprocess y Process antes de upsert.
 * Schemas permisivos: campos opcionales mantienen compatibilidad con data legacy.
 */

import { z } from 'zod'

/** Fila para la tabla `macroprocesses`. */
export const MacroprocessSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  company_id: z.string().nullable().optional(),
  name: z.string().min(1).max(500),
  category: z.enum(['estrategico', 'productivo', 'apoyo']),
  sort_order: z.number().int().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type MacroprocessRow = z.infer<typeof MacroprocessSchema>

/** Fila para la tabla `processes`. */
export const ProcessSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  company_id: z.string().nullable().optional(),
  macroprocess_id: z.string().uuid(),
  parent_process_id: z.string().uuid().nullable().optional(),
  level_definition_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(500),
  code: z.string().optional(),
  description: z.string().optional(),
  is_critical: z.boolean().optional(),
  has_contingency_plan: z.boolean().optional(),
  involves_cash_movement: z.boolean().optional(),
  has_tax_operations: z.boolean().optional(),
  affects_accounting: z.boolean().optional(),
  handles_personal_data: z.boolean().optional(),
  provided_by_third_party: z.boolean().optional(),
  bpmn_xml: z.string().optional(),
  sort_order: z.number().int().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough() // permite campos adicionales del catálogo (entity, process_type, etc.)

export type ProcessRow = z.infer<typeof ProcessSchema>
