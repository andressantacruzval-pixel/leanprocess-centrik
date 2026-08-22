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

export type ChartEntity = 'risks' | 'processes'
export type ChartGroupBy = 'area' | 'category' | 'level' | 'macro' | 'process' | 'executor'
export type ControlFilter = 'inadequate' | 'none' | 'any'

export interface ChartSpec {
  entity: ChartEntity
  groupBy: ChartGroupBy
  control?: ControlFilter // solo riesgos
  category?: string // solo riesgos (Operacional, etc.)
  area?: string // filtra por área
  title?: string
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
  if (spec.entity === 'risks') {
    let rows = resolveRisks(data)
    if (spec.control === 'inadequate') rows = rows.filter((r) => !r.adequate)
    else if (spec.control === 'none') rows = rows.filter((r) => r.risk.controls.length === 0)
    if (spec.category) rows = rows.filter((r) => norm(r.risk.category) === norm(spec.category!))
    if (spec.area) rows = rows.filter((r) => norm(r.area) === norm(spec.area!))
    const keyed = rows.map((r) => {
      switch (spec.groupBy) {
        case 'category': return { key: r.risk.category }
        case 'level': return { key: r.level, hex: LEVEL_HEX[r.level] }
        case 'process': return { key: r.processName }
        case 'executor': return { key: r.executor }
        case 'macro': {
          const macros = macroNameById(data)
          const p = processById(data).get(r.risk.process_id)
          return { key: macroOf(p, macros) }
        }
        case 'area':
        default: return { key: r.area }
      }
    })
    return tally(keyed)
  }

  // entity === 'processes'
  const macros = macroNameById(data)
  let procs = data.processes
  if (spec.area) procs = procs.filter((p) => norm(areaOf(p)) === norm(spec.area!))
  const keyed = procs.map((p) => {
    switch (spec.groupBy) {
      case 'macro': return { key: macroOf(p, macros) }
      case 'area':
      default: return { key: areaOf(p) }
    }
  })
  return tally(keyed)
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
