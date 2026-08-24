// ── Activos de Información (ISO/IEC 27001) ────────────────────────────────
// Fase 1: inventario y trazabilidad. El riesgo de activos (Fase 2) reutiliza la
// misma matriz 5×5 de los riesgos de proceso, pero el impacto se evalúa en TRES
// dimensiones (Confidencialidad, Integridad, Disponibilidad); la probabilidad se
// evalúa por dimensión y el nivel del activo es el MAYOR de las tres.

export type AssetType =
  | 'Información' | 'Software' | 'Hardware' | 'Red' | 'Servicio'
  | 'Personas' | 'Físico' | 'Intangible'

export const ASSET_TYPES: AssetType[] = [
  'Información', 'Software', 'Hardware', 'Red', 'Servicio', 'Personas', 'Físico', 'Intangible',
]

export type AssetFormat = 'Digital' | 'Físico' | 'Verbal'
export const ASSET_FORMATS: AssetFormat[] = ['Digital', 'Físico', 'Verbal']

// Ciclo de vida del activo en un proceso (trazabilidad / Data Journey).
export type AssetOperationKind = 'crea' | 'usa' | 'almacena' | 'transforma' | 'transfiere' | 'elimina'
export const ASSET_OPERATIONS: { value: AssetOperationKind; label: string }[] = [
  { value: 'crea', label: 'Crea' },
  { value: 'usa', label: 'Usa / Consulta' },
  { value: 'almacena', label: 'Almacena' },
  { value: 'transforma', label: 'Transforma' },
  { value: 'transfiere', label: 'Transfiere' },
  { value: 'elimina', label: 'Elimina' },
]

export type AssetStatus = 'activo' | 'en_revision' | 'retirado'
export const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'retirado', label: 'Retirado' },
]

// ── Dimensión C·I·D ───────────────────────────────────────────────────────
export type CiaDimension = 'C' | 'I' | 'A'

// Escala CUALITATIVA de IMPACTO por dimensión (1-5). La probabilidad usa la
// escala de riesgos (PROBABILITY_LABELS en types/risk). El nivel de riesgo del
// activo = máximo de (probabilidad×impacto) entre C, I y A.
export const CIA_IMPACT_SCALE: Record<CiaDimension, { label: string; levels: Record<number, string> }> = {
  C: {
    label: 'Confidencialidad',
    levels: {
      1: 'Insignificante — información pública; su divulgación no causa daño.',
      2: 'Menor — uso interno; divulgación con molestia leve.',
      3: 'Moderado — datos internos sensibles; divulgación con daño operativo/reputacional acotado.',
      4: 'Mayor — datos confidenciales o personales; divulgación con daño legal/financiero serio.',
      5: 'Catastrófico — datos críticos/regulados; divulgación con sanción grave, pérdida mayor o daño irreparable.',
    },
  },
  I: {
    label: 'Integridad',
    levels: {
      1: 'Insignificante — un error no afecta decisiones ni operación.',
      2: 'Menor — errores tolerables, corregibles sin impacto relevante.',
      3: 'Moderado — la alteración causa retrabajo y decisiones subóptimas.',
      4: 'Mayor — datos corruptos llevan a decisiones erróneas con daño serio.',
      5: 'Catastrófico — la manipulación provoca fraude, incumplimiento o pérdida irreparable.',
    },
  },
  A: {
    label: 'Disponibilidad',
    levels: {
      1: 'Insignificante — puede faltar días sin afectar el proceso.',
      2: 'Menor — indisponibilidad tolerable de horas.',
      3: 'Moderado — su falta interrumpe el proceso de forma acotada.',
      4: 'Mayor — su indisponibilidad detiene procesos clave con daño serio.',
      5: 'Catastrófico — sin él la operación se detiene; daño crítico inmediato.',
    },
  },
}

// Etiqueta de clasificación derivada de la Confidencialidad.
export function assetLabel(confidentiality: number | null | undefined): string {
  switch (confidentiality) {
    case 5: return 'Restringido'
    case 4: return 'Confidencial'
    case 3: return 'Confidencial'
    case 2: return 'Interno'
    default: return 'Público'
  }
}

// Criticidad del activo = mayor de C·I·D (coherente con «el nivel es el mayor»).
export function assetCriticality(c?: number | null, i?: number | null, a?: number | null): number {
  return Math.max(c || 0, i || 0, a || 0)
}

export interface InformationAsset {
  id: string
  company_id: string
  process_id: string | null
  org_unit_id: string | null
  bpmn_element_id: string | null
  code: string
  name: string
  description: string
  asset_type: string
  format: string
  owner: string
  custodian: string
  users: string
  location: string
  confidentiality: number | null
  integrity: number | null
  availability: number | null
  criticality: number | null
  label: string
  has_personal_data: boolean
  personal_data_category: string
  legal_requirements: string
  retention_period: string
  disposal_method: string
  status: string
  review_date: string | null
  next_review_date: string | null
  version: string
  created_at: string
  updated_at: string
}
