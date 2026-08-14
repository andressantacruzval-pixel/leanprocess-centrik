import { z } from 'zod'

const ClassificationEnum = z.enum(['VA', 'NVA', 'NVABN'])

/** Fila para la tabla `value_activities` (snake_case). */
export const ValueActivityRowSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  company_id: z.string(),
  activity_name: z.string().min(1).max(500),
  classification: ClassificationEnum.optional(),
  description: z.string().optional(),
  time_minutes: z.number().int().min(0).optional(),
  responsible: z.string().optional(),
  bpmn_element_id: z.string().nullable().optional(),
  order_index: z.number().int().min(0).optional(),
})

export type ValueActivityRow = z.infer<typeof ValueActivityRowSchema>
