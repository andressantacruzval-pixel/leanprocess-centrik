/**
 * procedure.schema — Zod schema para ProcedureData antes de persistir.
 */

import { z } from 'zod'

export const ProcedureActivitySchema = z.object({
  nombre: z.string().min(1).max(500),
  ejecutor: z.string().optional(),
  descripcion: z.string().optional(),
  decisiones: z.string().optional(),
  esDecision: z.boolean().optional(),
})

export const ProcedureRowSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  company_id: z.string(),
  titulo: z.string().min(1).max(500),
  codigo: z.string().optional(),
  version: z.string().optional(),
  fecha: z.string().optional(),
  introduccion: z.string().optional(),
  objetivo_general: z.string().optional(),
  objetivos_especificos: z.array(z.string()).optional(),
  alcance: z.string().optional(),
  actividades: z.array(ProcedureActivitySchema).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}).passthrough()

export type ProcedureRow = z.infer<typeof ProcedureRowSchema>
