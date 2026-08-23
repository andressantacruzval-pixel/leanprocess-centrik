// ─── Copiloto — capa de datos DETERMINISTA ────────────────────────────────
// Todo número, lista o gráfico del copiloto sale de aquí, NO del modelo. Esto
// garantiza el carril de "datos": exacto y nunca alucinado. El LLM solo narra
// y aconseja sobre lo que estas funciones ya resolvieron.
//
// Nota clave (pedido del usuario): la especificidad "quién hace qué" se apoya en
// los nodos de actividad por lane/ejecutor del BPMN — los mismos que usa el
// mapeo de flujo de valor (parseBpmnXml → laneName por actividad).

import type { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import type { Process } from '@/types/process'
import type { RiskItem } from '@/types/risk'
import { getRiskLevel } from '@/types/risk'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { norm } from '@/features/inventory/inventoryUtils'
import { CLASSIFICATION_COLORS } from '@/utils/valueAnalysis'
import { STATUS_LABELS, IMPROVEMENT_TYPE_LABELS, priorityScore, priorityLabel } from '@/types/improvement'

export type ScopedData = ReturnType<typeof useCompanyScopedData>

// Un control es "adecuado" si su efectividad es Regular o superior (score ≥ 17,
// misma escala que computeControlScore en types/risk).
export const ADEQUATE_CONTROL_MIN_SCORE = 17

export function hasAdequateControl(risk: RiskItem): boolean {
  return risk.controls.some((c) => c.score >= ADEQUATE_CONTROL_MIN_SCORE)
}

export function riskInherentScore(risk: RiskItem): number {
  return risk.inherentProbability * risk.inherentImpact
}

export function riskLevelLabel(risk: RiskItem): string {
  return getRiskLevel(risk.inherentProbability, risk.inherentImpact).label
}

// ── Índices reutilizables ─────────────────────────────────────────────────

export function processById(data: ScopedData): Map<string, Process> {
  return new Map(data.processes.map((p) => [p.id, p]))
}

export function macroNameById(data: ScopedData): Map<string, string> {
  return new Map(data.macroprocesses.map((m) => [m.id, m.name]))
}

/** Área de un proceso: coordinación (hoja) → gerencia → sin área. */
export function areaOf(p: Process | undefined): string {
  return p?.coordination || p?.management || '(sin área)'
}

export function macroOf(p: Process | undefined, macros: Map<string, string>): string {
  return (p && macros.get(p.macroprocess_id)) || '(sin macroproceso)'
}

/**
 * Mapa actividad(normalizada) → lane/ejecutor, construido de TODOS los BPMN de
 * la empresa. Permite ubicar el ejecutor de un riesgo por su `processStep`.
 */
export function executorMap(data: ScopedData): Map<string, string> {
  const map = new Map<string, string>()
  // 1) Lanes del BPMN.
  for (const p of data.processes) {
    if (!p.bpmn_xml) continue
    try {
      const parsed = parseBpmnXml(p.bpmn_xml)
      for (const a of parsed.activities) {
        if (a.laneName) map.set(norm(a.name), a.laneName)
      }
    } catch {
      // XML corrupto: se ignora ese proceso, sin romper el resto.
    }
  }
  // 2) Ejecutor explícito por actividad del PROCEDIMIENTO (fuente más fiable del
  //    rol). Sobrescribe al lane porque aquí el rol está declarado a mano.
  for (const pr of data.procedures) {
    for (const act of pr.data?.actividades ?? []) {
      if (act.ejecutor && act.nombre) map.set(norm(act.nombre), act.ejecutor)
    }
  }
  return map
}

export function executorOf(risk: RiskItem, execs: Map<string, string>): string {
  return (risk.processStep && execs.get(norm(risk.processStep))) || '(sin ejecutor asignado)'
}

// ── Consultas determinísticas de negocio ──────────────────────────────────

/** Riesgos sin control adecuado, con su proceso/área/nivel/ejecutor resueltos. */
export interface ResolvedRisk {
  risk: RiskItem
  processName: string
  area: string
  level: string
  executor: string
  adequate: boolean
}

export function resolveRisks(data: ScopedData): ResolvedRisk[] {
  const procs = processById(data)
  const execs = executorMap(data)
  return data.risks.map((risk) => {
    const p = procs.get(risk.process_id)
    return {
      risk,
      processName: p?.name ?? '(proceso desconocido)',
      area: areaOf(p),
      level: riskLevelLabel(risk),
      executor: executorOf(risk, execs),
      adequate: hasAdequateControl(risk),
    }
  })
}

export function risksWithoutAdequateControl(data: ScopedData): ResolvedRisk[] {
  return resolveRisks(data).filter((r) => !r.adequate)
}

// ── Motor de gráficos (agregación determinista) ───────────────────────────

export type ChartEntity = 'risks' | 'processes' | 'indicators' | 'value' | 'improvements'
export type ChartGroupBy =
  | 'area' | 'category' | 'level' | 'macro' | 'process' | 'executor'
  | 'classification' | 'status' | 'type' | 'priority' | 'meta' | 'frequency'
export type ControlFilter = 'inadequate' | 'none' | 'any'

export interface ChartSpec {
  entity: ChartEntity
  groupBy: ChartGroupBy
  control?: ControlFilter // solo riesgos
  category?: string // solo riesgos (Operacional, etc.)
  area?: string // filtra por área
  status?: string // solo mejoras (cerrada, aprobada, …)
  metric?: 'count' | 'minutes' // solo valor
  basis?: RiskBasis // solo riesgos: nivel inherente (def.) o residual
  title?: string
}

const STATUS_HEX: Record<string, string> = {
  propuesta: '#94a3b8', aprobada: '#3b82f6', en_progreso: '#f59e0b', cerrada: '#10b981', descartada: '#ef4444',
}
const VALUE_HEX: Record<string, string> = {
  VA: CLASSIFICATION_COLORS.VA.hex, NVA: CLASSIFICATION_COLORS.NVA.hex, NVABN: CLASSIFICATION_COLORS.NVABN.hex,
}

export interface ChartDatum {
  label: string
  value: number
  hex?: string
}

const LEVEL_HEX: Record<string, string> = {
  Extremo: '#ef4444',
  Alto: '#f97316',
  Moderado: '#facc15',
  Bajo: '#10b981',
}

function tally(rows: { key: string; hex?: string }[]): ChartDatum[] {
  const counts = new Map<string, { value: number; hex?: string }>()
  for (const r of rows) {
    const prev = counts.get(r.key)
    if (prev) prev.value += 1
    else counts.set(r.key, { value: 1, hex: r.hex })
  }
  return [...counts.entries()]
    .map(([label, { value, hex }]) => ({ label, value, hex }))
    .sort((a, b) => b.value - a.value)
}

export function computeChart(data: ScopedData, spec: ChartSpec): ChartDatum[] {
  const macros = macroNameById(data)
  const procs = processById(data)
  const procName = (id: string) => procs.get(id)?.name ?? '(proceso)'

  switch (spec.entity) {
    case 'risks': {
      let rows = resolveRisks(data)
      if (spec.control === 'inadequate') rows = rows.filter((r) => !r.adequate)
      else if (spec.control === 'none') rows = rows.filter((r) => r.risk.controls.length === 0)
      if (spec.category) rows = rows.filter((r) => norm(r.risk.category) === norm(spec.category!))
      if (spec.area) rows = rows.filter((r) => norm(r.area) === norm(spec.area!))
      const levelOf = (r: ResolvedRisk) => spec.basis === 'residual'
        ? getRiskLevel(r.risk.residualProbability, r.risk.residualImpact).label
        : r.level
      return tally(rows.map((r) => {
        switch (spec.groupBy) {
          case 'category': return { key: r.risk.category }
          case 'level': { const lvl = levelOf(r); return { key: lvl, hex: LEVEL_HEX[lvl] } }
          case 'process': return { key: r.processName }
          case 'executor': return { key: r.executor }
          case 'macro': return { key: macroOf(procs.get(r.risk.process_id), macros) }
          default: return { key: r.area }
        }
      }))
    }

    case 'processes': {
      let list = data.processes
      if (spec.area) list = list.filter((p) => norm(areaOf(p)) === norm(spec.area!))
      return tally(list.map((p) => {
        switch (spec.groupBy) {
          case 'macro': return { key: macroOf(p, macros) }
          case 'category': return { key: macros.get(p.macroprocess_id) ? macroOf(p, macros) : '(sin macro)' }
          default: return { key: areaOf(p) }
        }
      }))
    }

    case 'indicators': {
      let rows = data.indicators
      if (spec.area) rows = rows.filter((i) => norm(areaOf(procs.get(i.process_id))) === norm(spec.area!))
      return tally(rows.map((i) => {
        switch (spec.groupBy) {
          case 'meta': return i.target_value
            ? { key: 'Con meta', hex: '#10b981' }
            : { key: 'Sin meta', hex: '#f59e0b' }
          case 'frequency': return { key: i.frequency || '(sin frecuencia)' }
          default: return { key: procName(i.process_id) }
        }
      }))
    }

    case 'value': {
      const minutes = spec.metric === 'minutes'
      const entries = Object.entries(data.analyses)
      if (spec.groupBy === 'process') {
        return entries
          .map(([pid, acts]) => ({
            label: procName(pid),
            value: minutes ? Math.round(acts.reduce((s, a) => s + a.dailyMinutes, 0)) : acts.length,
          }))
          .filter((d) => d.value > 0)
          .sort((a, b) => b.value - a.value)
      }
      // Por defecto: distribución VA / NVA / NVABN.
      const acc: Record<string, number> = { VA: 0, NVA: 0, NVABN: 0 }
      for (const [, acts] of entries) {
        for (const a of acts) {
          if (a.classification) acc[a.classification] += minutes ? a.dailyMinutes : 1
        }
      }
      return (['VA', 'NVA', 'NVABN'] as const)
        .map((k) => ({ label: CLASSIFICATION_COLORS[k].label, value: minutes ? Math.round(acc[k]) : acc[k], hex: VALUE_HEX[k] }))
        .filter((d) => d.value > 0)
    }

    case 'improvements': {
      let rows = data.improvements
      if (spec.status) rows = rows.filter((o) => o.status === spec.status)
      return tally(rows.map((o) => {
        switch (spec.groupBy) {
          case 'type': return { key: IMPROVEMENT_TYPE_LABELS[o.type] ?? o.type }
          case 'process': return { key: procName(o.processId) }
          case 'priority': return { key: priorityLabel(priorityScore(o)).label }
          default: return { key: STATUS_LABELS[o.status] ?? o.status, hex: STATUS_HEX[o.status] }
        }
      }))
    }
  }
}

// ── Matriz de calor 5×5 (probabilidad × impacto) ──────────────────────────
export interface HeatmapCell { probability: number; impact: number; count: number }

export type RiskBasis = 'inherent' | 'residual'

export function heatmapMatrix(data: ScopedData, f: { process?: string; category?: string; basis?: RiskBasis } = {}): { cells: HeatmapCell[]; total: number } {
  let rows = resolveRisks(data)
  if (f.process) { const t = norm(f.process); rows = rows.filter((r) => norm(r.processName).includes(t)) }
  if (f.category) rows = rows.filter((r) => norm(r.risk.category) === norm(f.category!))
  const residual = f.basis === 'residual'
  const counts = new Map<string, number>()
  for (const r of rows) {
    const p = residual ? r.risk.residualProbability : r.risk.inherentProbability
    const i = residual ? r.risk.residualImpact : r.risk.inherentImpact
    counts.set(`${p}-${i}`, (counts.get(`${p}-${i}`) ?? 0) + 1)
  }
  const cells: HeatmapCell[] = []
  for (let impact = 5; impact >= 1; impact--) {
    for (let probability = 1; probability <= 5; probability++) {
      cells.push({ probability, impact, count: counts.get(`${probability}-${impact}`) ?? 0 })
    }
  }
  return { cells, total: rows.length }
}

// ── Lectura automática de un gráfico (carril determinista) ─────────────────
export function chartInsight(datums: ChartDatum[]): string {
  if (!datums.length) return ''
  const total = datums.reduce((s, d) => s + d.value, 0)
  if (total === 0) return ''
  const top = datums[0]
  const pct = Math.round((top.value / total) * 100)
  if (datums.length === 1) return `Todo (${total}) se concentra en «${top.label}».`
  return `«${top.label}» concentra el ${pct}% (${top.value} de ${total}).`
}

// ── Resolución de un proceso por nombre (para citas/fichas) ────────────────

export function findProcessByName(data: ScopedData, name: string): Process | undefined {
  if (!name) return undefined
  const target = norm(name)
  return (
    data.processes.find((p) => norm(p.name) === target) ??
    data.processes.find((p) => norm(p.name).includes(target) || target.includes(norm(p.name)))
  )
}

// Lista de riesgos REALES para el widget <<RISKS>> (evita que el modelo invente
// títulos). Filtra por proceso, estado de control, nivel y/o categoría.
export interface RiskWidgetFilter {
  process?: string
  control?: ControlFilter
  level?: string
  category?: string
}

export function risksForWidget(data: ScopedData, f: RiskWidgetFilter): ResolvedRisk[] {
  let rows = resolveRisks(data)
  if (f.process) { const t = norm(f.process); rows = rows.filter((r) => norm(r.processName).includes(t)) }
  if (f.control === 'inadequate') rows = rows.filter((r) => !r.adequate)
  else if (f.control === 'none') rows = rows.filter((r) => r.risk.controls.length === 0)
  if (f.category) rows = rows.filter((r) => norm(r.risk.category) === norm(f.category!))
  if (f.level) { const t = norm(f.level); rows = rows.filter((r) => norm(r.level) === t) }
  return rows.sort((a, b) => riskInherentScore(b.risk) - riskInherentScore(a.risk))
}

export function findRisk(data: ScopedData, processName: string, title: string): ResolvedRisk | undefined {
  const t = norm(title)
  const resolved = resolveRisks(data)
  const byTitle = resolved.filter((r) => norm(r.risk.title) === t || norm(r.risk.title).includes(t))
  if (processName) {
    const p = norm(processName)
    return byTitle.find((r) => norm(r.processName) === p || norm(r.processName).includes(p)) ?? byTitle[0]
  }
  return byTitle[0]
}
