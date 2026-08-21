// ─── Oportunidades de mejora (planes de acción) ───────────────────────────

export type ScoreValue = 1 | 3 | 5

export type ImprovementStatus =
  | 'propuesta'
  | 'aprobada'
  | 'en_progreso'
  | 'cerrada'
  | 'descartada'

/** Catálogo del tipo/objetivo de la mejora (máx. 6). */
export type ImprovementType =
  | 'eficiencia'
  | 'eficacia'
  | 'riesgos'
  | 'calidad'
  | 'experiencia'
  | 'cumplimiento'

/** Hito / subtarea delegable dentro de una oportunidad (checklist tipo Trello). */
export interface ImprovementMilestone {
  id: string
  title: string
  responsible: string
  done: boolean
}

export interface ImprovementOpportunity {
  id: string
  processId: string
  companyId: string
  name: string
  description: string
  milestones: ImprovementMilestone[]
  /** 1/3/5 — 5 = muy bueno (bajo costo), 1 = muy malo (alto costo). */
  costScore: ScoreValue
  /** 1/3/5 — 5 = muy bueno (baja complejidad), 1 = muy malo (alta complejidad). */
  complexityScore: ScoreValue
  /** 1/3/5 — 5 = muy bueno (corto tiempo), 1 = muy malo (largo tiempo). */
  timeScore: ScoreValue
  responsible: string
  /** Tipo/objetivo de la mejora (catálogo). */
  type: ImprovementType
  startDate: string | null
  endDate: string | null
  status: ImprovementStatus
  progressNotes: string
  progressPct: number
  closeDate: string | null
  createdAt: string
}

export const SCORE_VALUES: ScoreValue[] = [1, 3, 5]

/** Etiquetas cualitativas por variable. 5 siempre es lo mejor. */
export const SCORE_LABELS: Record<'cost' | 'complexity' | 'time', Record<ScoreValue, string>> = {
  cost:       { 5: 'Bajo',  3: 'Medio', 1: 'Alto' },
  complexity: { 5: 'Baja',  3: 'Media', 1: 'Alta' },
  time:       { 5: 'Corto', 3: 'Medio', 1: 'Largo' },
}

export const STATUS_LABELS: Record<ImprovementStatus, string> = {
  propuesta:   'Propuesta',
  aprobada:    'Aprobada',
  en_progreso: 'En progreso',
  cerrada:     'Cerrada',
  descartada:  'Descartada',
}

export const STATUS_OPTIONS: ImprovementStatus[] = [
  'propuesta', 'aprobada', 'en_progreso', 'cerrada', 'descartada',
]

export const IMPROVEMENT_TYPE_LABELS: Record<ImprovementType, string> = {
  eficiencia:   'Eficiencia',
  eficacia:     'Eficacia',
  riesgos:      'Mitigación de riesgos',
  calidad:      'Calidad',
  experiencia:  'Experiencia del cliente',
  cumplimiento: 'Cumplimiento normativo',
}

export const IMPROVEMENT_TYPE_OPTIONS: ImprovementType[] = [
  'eficiencia', 'eficacia', 'riesgos', 'calidad', 'experiencia', 'cumplimiento',
]

export const IMPROVEMENT_TYPE_COLORS: Record<ImprovementType, string> = {
  eficiencia:   '#06b6d4',
  eficacia:     '#10b981',
  riesgos:      '#ef4444',
  calidad:      '#8b5cf6',
  experiencia:  '#f59e0b',
  cumplimiento: '#ec4899',
}

/** Acota un valor cualquiera a un ImprovementType válido (default eficiencia). */
export function clampImprovementType(v: unknown): ImprovementType {
  return IMPROVEMENT_TYPE_OPTIONS.includes(v as ImprovementType) ? (v as ImprovementType) : 'eficiencia'
}

/** Prioridad = suma de las tres variables (3..15). Más alto = quick win. */
export function priorityScore(o: Pick<ImprovementOpportunity, 'costScore' | 'complexityScore' | 'timeScore'>): number {
  return o.costScore + o.complexityScore + o.timeScore
}

/** Etiqueta de prioridad a partir del puntaje total. */
export function priorityLabel(total: number): { label: string; tone: 'high' | 'mid' | 'low' } {
  if (total >= 12) return { label: 'Quick win', tone: 'high' }
  if (total >= 8) return { label: 'Media', tone: 'mid' }
  return { label: 'Difícil', tone: 'low' }
}

/** Acota un número a 1/3/5 (por si la IA devuelve 2/4). */
export function clampScore(n: unknown): ScoreValue {
  const v = Number(n)
  if (v >= 5) return 5
  if (v <= 1) return 1
  return 3
}
