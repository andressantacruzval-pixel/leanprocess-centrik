import { z } from 'zod'

/** Fila para la tabla `audits` (snake_case). */
export const AuditRowSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  company_id: z.string(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type AuditRow = z.infer<typeof AuditRowSchema>

const AuditFrequency = z.enum(['Diaria', 'Semanal', 'Mensual', 'Trimestral', 'Semestral', 'Anual']).optional()
const EvidenceType = z.enum(['Documento', 'Registro', 'Observacion', 'Entrevista', 'Muestreo']).optional()

/** Fila para la tabla `audit_items` (snake_case). */
export const AuditItemRowSchema = z.object({
  id: z.string().uuid(),
  audit_id: z.string().uuid(),
  criterion: z.string().min(1).max(1000).optional(),
  what_to_audit: z.string().optional(),
  how_to_audit: z.string().optional(),
  frequency: AuditFrequency,
  responsible: z.string().optional(),
  evidence_type: EvidenceType,
  bpmn_element_id: z.string().nullable().optional(),
  order_index: z.number().int().min(0).optional(),
})

export type AuditItemRow = z.infer<typeof AuditItemRowSchema>
