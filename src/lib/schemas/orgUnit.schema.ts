import { z } from 'zod'

/** Fila para la tabla `org_units` (snake_case). */
export const OrgUnitRowSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string(),
  name: z.string().min(1).max(300),
  level_id: z.string().uuid().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  responsible: z.string().optional().nullable(),
  order_index: z.number().int().min(0).optional(),
})

export type OrgUnitRow = z.infer<typeof OrgUnitRowSchema>
