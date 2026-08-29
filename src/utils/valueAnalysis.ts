// ── Value Analysis Types & Utilities ──

export type ValueClassification = 'VA' | 'NVA' | 'NVABN'
export type Frequency = 'diaria' | 'semanal' | 'mensual' | 'ad-hoc'
export type TimePeriod = 'hora' | 'dia' | 'semana' | 'mes' | 'año'

export interface ValueActivity {
  id: string                    // UUID de DB (PK)
  bpmnNodeId: string            // id del nodo BPMN (ej: "Task_5") — usado para mapear con el diagrama
  name: string                  // activity name from BPMN
  laneName?: string             // lane/role
  classification: ValueClassification | null
  frequency: Frequency
  timePerOccurrence: number     // minutes
  occurrences: number           // times per frequency period
  dailyMinutes: number          // computed: normalized to daily
}

export const CLASSIFICATION_COLORS: Record<ValueClassification, { bg: string; text: string; label: string; hex: string }> = {
  VA:    { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Valor Agregado',              hex: '#34d399' },
  NVA:   { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Sin Valor Agregado',          hex: '#f87171' },
  NVABN: { bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Sin Valor - Necesario',       hex: '#fbbf24' },
}

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'diaria',  label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'ad-hoc',  label: 'Ad-hoc' },
]

export const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: 'hora',   label: 'Por Hora' },
  { value: 'dia',    label: 'Por Día' },
  { value: 'semana', label: 'Por Semana' },
  { value: 'mes',    label: 'Por Mes' },
  { value: 'año',    label: 'Por Año' },
]

// ── Daily normalization ──
// Convert total minutes per frequency period → daily minutes
export function normalizeToDailyMinutes(
  timePerOccurrence: number,
  occurrences: number,
  frequency: Frequency
): number {
  const totalMinutes = timePerOccurrence * occurrences
  switch (frequency) {
    case 'diaria':  return totalMinutes          // already daily
    case 'semanal': return totalMinutes / 5      // 5 working days
    case 'mensual': return totalMinutes / 20     // 20 working days
    case 'ad-hoc':  return totalMinutes / 60     // ~60 working days (quarterly)
  }
}

// ── Period scaling ──
// Scale daily minutes to desired period
export function scaleToPeriod(dailyMinutes: number, period: TimePeriod): number {
  switch (period) {
    case 'hora':   return dailyMinutes / 8       // 8-hour workday
    case 'dia':    return dailyMinutes
    case 'semana': return dailyMinutes * 5
    case 'mes':    return dailyMinutes * 20
    case 'año':    return dailyMinutes * 240     // 240 working days
  }
}

// ── Format time display ──
export function formatTime(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)}s`
  if (minutes < 60) return `${Math.round(minutes * 10) / 10}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ── KPI Calculations ──
export interface ValueKPIs {
  totalActivities: number
  vaCount: number
  nvaCount: number
  nvabnCount: number
  unclassifiedCount: number
  totalDailyMinutes: number
  vaDailyMinutes: number
  nvaDailyMinutes: number
  nvabnDailyMinutes: number
  vaEfficiency: number          // VA time / total time * 100
  wastePercentage: number       // NVA time / total time * 100
  cycleTimeMinutes: number      // sum of all timePerOccurrence (sequential)
}

export function computeKPIs(activities: ValueActivity[]): ValueKPIs {
  const classified = activities.filter(a => a.classification !== null)
  const va = classified.filter(a => a.classification === 'VA')
  const nva = classified.filter(a => a.classification === 'NVA')
  const nvabn = classified.filter(a => a.classification === 'NVABN')

  const totalDailyMinutes = activities.reduce((s, a) => s + a.dailyMinutes, 0)
  const vaDailyMinutes = va.reduce((s, a) => s + a.dailyMinutes, 0)
  const nvaDailyMinutes = nva.reduce((s, a) => s + a.dailyMinutes, 0)
  const nvabnDailyMinutes = nvabn.reduce((s, a) => s + a.dailyMinutes, 0)

  return {
    totalActivities: activities.length,
    vaCount: va.length,
    nvaCount: nva.length,
    nvabnCount: nvabn.length,
    unclassifiedCount: activities.length - classified.length,
    totalDailyMinutes,
    vaDailyMinutes,
    nvaDailyMinutes,
    nvabnDailyMinutes,
    vaEfficiency: totalDailyMinutes > 0 ? (vaDailyMinutes / totalDailyMinutes) * 100 : 0,
    wastePercentage: totalDailyMinutes > 0 ? (nvaDailyMinutes / totalDailyMinutes) * 100 : 0,
    cycleTimeMinutes: activities.reduce((s, a) => s + a.timePerOccurrence, 0),
  }
}

// ── Pareto Analysis (80/20) ──
export interface ParetoItem {
  activity: ValueActivity
  scaledMinutes: number
  cumulativePercent: number
  isCritical: boolean  // within top 80%
}

export function computePareto(activities: ValueActivity[], period: TimePeriod): ParetoItem[] {
  const items = activities
    .map(a => ({ activity: a, scaledMinutes: scaleToPeriod(a.dailyMinutes, period) }))
    .sort((a, b) => b.scaledMinutes - a.scaledMinutes)

  const total = items.reduce((s, i) => s + i.scaledMinutes, 0)
  if (total === 0) return items.map(i => ({ ...i, cumulativePercent: 0, isCritical: false }))

  let cumulative = 0
  return items.map(i => {
    cumulative += i.scaledMinutes
    const cumulativePercent = (cumulative / total) * 100
    return { ...i, cumulativePercent, isCritical: cumulativePercent <= 80 }
  })
}
